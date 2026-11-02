# frozen_string_literal: true

# In-memory cache store behind `ProjectMembership::Lookup`.
#
# Per-process, in-memory LRU built on a dedicated
# `Verse::Cache::Impl::MemoryCacheAdapter` (not the global `Verse::Cache`, so
# services don't need a global cache config). It is a thin wrapper: it adds
# nil/empty caching (the adapter returns nil on a miss, so we store a `{ value: }`
# wrapper to distinguish a cached empty result from a miss) and the invalidation
# entry points the broadcast expo uses.
#
# Configuration comes from the service config block `idah.project_membership_cache`
# (`Verse.config.extra_fields.dig(:idah, :project_membership_cache, ...)`):
#   enabled:  bool   (default true)  — when false, the cache is a no-op passthrough
#   ttl:      int    (default 300)   — seconds before an entry expires
#   capacity: int    (default 10_000) — LRU capacity (bounds memory)
#
# A default TTL bounds the staleness a missed invalidation broadcast can leave
# behind: without one, a stale entry would live until the next invalidation or a
# process restart.
#
# The store is a process-wide singleton (`Cache.instance`) so the lookup and the
# broadcast invalidation expo share the same adapter. `reset!` exists for specs.
module ProjectMembership
  class Cache
    class << self
      def instance
        @instance ||= new
      end

      # For specs: drop the singleton so a fresh (empty) cache is built next.
      def reset!
        @instance = nil
      end
    end

    # Key families. Each family maps a single id (selector) to one cached value,
    # so a multi-id aggregate is composed from per-id entries and one
    # invalidation never leaves a stale aggregate.
    MEMBERSHIPS_KEY = "memberships"
    MEMBER_ACCOUNT_IDS_PROJECT_KEY = "member_account_ids:project"
    MEMBER_ACCOUNT_IDS_ORG_KEY = "member_account_ids:org"
    PROJECT_IDS_ORG_KEY = "project_ids:org"

    def initialize(config = nil)
      @config = config ? normalize_config(config) : read_config
      @adapter = Verse::Cache::Impl::MemoryCacheAdapter.new(@config[:capacity])
      # Global invalidation counter: every invalidation increments it, and a
      # `fetch` stores its computed value only if the counter is unchanged since
      # the block started. This closes the fetch/invalidate race (an invalidation
      # arriving while a fetch's HTTP call is in flight clears nothing, so the
      # stale result is dropped instead of stored). A single global counter keeps
      # memory flat; the cost is only an occasional skipped store during bursts.
      @invalidation_counter = 0
      @mutex = Mutex.new
    end

    def enabled?
      @config[:enabled]
    end

    # Returns the cached value for (key, selector), or computes it from the block
    # and caches it. Any value is cached, including nil and empty arrays (wrapped
    # so a miss — nil from the adapter — is distinguishable from a cached empty
    # result). `ex:` (TTL) is passed on every store (the default is 300s).
    #
    # The block (which makes an HTTP call) runs WITHOUT the mutex held. The
    # invalidation counter is read before the block and the check-then-store runs
    # under the mutex, so an invalidation that fires while the block is in flight
    # drops the stale result instead of storing it.
    #
    # Cached values are deep-frozen so a caller mutating a returned array/struct
    # cannot corrupt the shared cache entry. The value is frozen in disabled mode
    # too, so mutation bugs surface in specs (which run with the cache disabled).
    def fetch(key, selector)
      return deep_freeze(yield) unless enabled?

      counter = @mutex.synchronize { @invalidation_counter }

      wrapped = @adapter.fetch(key, selector.to_s)
      if wrapped.nil?
        value = yield
        @mutex.synchronize do
          if @invalidation_counter == counter
            @adapter.cache(key, selector.to_s, { value: deep_freeze(value) }, ex: ttl_seconds)
          end
        end
        value
      else
        wrapped[:value]
      end
    end

    # Deep-freezes a cached value (arrays of structs/hashes). Returns the frozen
    # value. Non-freezable values (e.g. nil) are returned as-is.
    def deep_freeze(value)
      case value
      when Array
        value.each { |item| deep_freeze(item) }
        value.freeze
      when Hash
        value.each { |k, v| deep_freeze(k); deep_freeze(v) }
        value.freeze
      when Struct
        value.each_pair { |_k, v| deep_freeze(v) }
        value.freeze
      else
        value.freeze if value.respond_to?(:freeze) && !value.frozen?
        value
      end
    end

    def invalidate_account(account_id)
      bump_invalidation_counter
      @adapter.flush(MEMBERSHIPS_KEY, account_id.to_s)
    end

    def invalidate_project(project_id, organization_id: nil)
      bump_invalidation_counter
      @adapter.flush(MEMBER_ACCOUNT_IDS_PROJECT_KEY, project_id.to_s)
      @adapter.flush(PROJECT_IDS_ORG_KEY, organization_id.to_s) if organization_id
    end

    def invalidate_organization(org_id)
      bump_invalidation_counter
      @adapter.flush(MEMBER_ACCOUNT_IDS_ORG_KEY, org_id.to_s)
      @adapter.flush(PROJECT_IDS_ORG_KEY, org_id.to_s)
    end

    def flush!
      bump_invalidation_counter
      @adapter.flush(MEMBERSHIPS_KEY, "*")
      @adapter.flush(MEMBER_ACCOUNT_IDS_PROJECT_KEY, "*")
      @adapter.flush(MEMBER_ACCOUNT_IDS_ORG_KEY, "*")
      @adapter.flush(PROJECT_IDS_ORG_KEY, "*")
    end

    private

    def read_config
      defaults = default_config
      block = config_block
      return defaults unless block

      defaults[:enabled] = block[:enabled] unless block[:enabled].nil?
      defaults[:ttl] = validate_ttl(block[:ttl]) unless block[:ttl].nil?
      defaults[:capacity] = block[:capacity] unless block[:capacity].nil?
      defaults
    end

    def normalize_config(config)
      defaults = default_config
      defaults[:enabled] = config[:enabled] unless config[:enabled].nil?
      defaults[:ttl] = validate_ttl(config[:ttl]) unless config[:ttl].nil?
      defaults[:capacity] = config[:capacity] unless config[:capacity].nil?
      defaults
    end

    # A TTL must be a positive Integer. `nil` is allowed only as an explicit
    # code-level option (entries never expire); 0 or negative values are rejected
    # because the adapter treats `ex: 0` as "expire immediately".
    def validate_ttl(ttl)
      return ttl if ttl.nil?

      unless ttl.is_a?(Integer) && ttl.positive?
        raise ArgumentError, "project_membership_cache ttl must be a positive Integer (got #{ttl.inspect})"
      end

      ttl
    end

    def default_config
      { enabled: true, ttl: 300, capacity: 10_000 }
    end

    # Every invalidation bumps the global counter so an in-flight `fetch` drops
    # its stale result instead of storing it.
    def bump_invalidation_counter
      @mutex.synchronize { @invalidation_counter += 1 }
    end

    # Reads the `idah.project_membership_cache` block from the service config.
    # Falls back to defaults when Verse is not started or the block is absent.
    def config_block
      return nil unless defined?(Verse) && Verse.respond_to?(:config)

      Verse.config.extra_fields.dig(:idah, :project_membership_cache)
    rescue StandardError => e
      Verse.logger&.warn do
        "ProjectMembership cache: failed to read config, using defaults (#{e.message})"
      end
      nil
    end

    def ttl_seconds
      @config[:ttl]
    end
  end
end
