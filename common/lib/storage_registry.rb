# frozen_string_literal: true

require "monitor"

# Shrine storages for per-project storage targets, built while the service runs.
#
# The verse-shrine plugin only builds the storages listed in config.yml, once, at
# boot. A storage target is an S3 location an admin registers later, so its
# storage is built here on first use and registered in `::Shrine.storages` under
# `target_<id>_<service>`. A `nil` target is the plugin's `:default` storage,
# exactly as before.
#
# Entries expire after a TTL, so credentials changed on a target are picked up
# even if the invalidation event was missed; `#evict` drops one at once. The
# storage stays registered until it is rebuilt, so an upload already running on
# it can finish.
#
# Each service keeps its own folder under the target's prefix, the same split as
# the default storages: `<prefix>/media/files` and `<prefix>/sync/files`.
#
# Credentials come from `credentials_provider`, a callable taking a target id and
# returning `{ endpoint:, region:, bucket:, prefix:, access_key_id:,
# secret_access_key: }`. They are kept in memory only, and `#inspect` never shows
# them.
class StorageRegistry
  include MonitorMixin

  # Raised when a target's storage can't be built: no credentials provider is
  # configured, or the provider has no such target.
  class TargetUnavailable < StandardError; end

  DEFAULT_TTL = 300 # seconds

  SERVICE_FOLDERS = {
    media: "media/files",
    sync: "sync/files"
  }.freeze

  # S3 error codes meaning the credentials were rejected: the target's secret may
  # have been rotated since the entry was built.
  CREDENTIAL_ERROR_CODES = %w[InvalidAccessKeyId SignatureDoesNotMatch ExpiredToken].freeze

  Entry = Struct.new(:key, :expires_at)

  class << self
    # The registry of this process, for the service set with `.configure`.
    def instance
      registry_lock.synchronize do
        @instance ||= new(service: @service || :media, credentials_provider: @credentials_provider)
      end
    end

    # Called from each service's initializer. Phase 1 adds the credentials
    # provider that fetches a target from the Setting service.
    def configure(service:, credentials_provider: nil)
      raise ArgumentError, "unknown service `#{service}`" unless SERVICE_FOLDERS.key?(service)

      registry_lock.synchronize do
        @service = service
        @credentials_provider = credentials_provider
        @instance = nil
      end
    end

    def with_storage(target_id, retriable: true, &) = instance.with_storage(target_id, retriable:, &)

    def evict(target_id) = instance.evict(target_id)

    # For specs: the next `.instance` builds a fresh registry.
    def reset!
      registry_lock.synchronize { @instance = nil }
    end

    private

    def registry_lock
      @registry_lock ||= Monitor.new
    end
  end

  attr_reader :service

  def initialize(service:, credentials_provider: nil, ttl: DEFAULT_TTL, clock: nil)
    super()

    raise ArgumentError, "unknown service `#{service}`" unless SERVICE_FOLDERS.key?(service)

    @service = service
    @credentials_provider = credentials_provider
    @ttl = ttl
    @clock = clock || -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) }
    @entries = {}
  end

  # The storage manager for a target, or the default storage for `nil`.
  def for(target_id)
    return Verse::Plugin[:shrine].storage if target_id.nil?

    key = storage_key(target_id)

    synchronize do
      entry = @entries[key]

      if entry.nil? || entry.expires_at <= @clock.call
        ::Shrine.storages[key] = build_storage(target_id)
        @entries[key] = Entry.new(key, @clock.call + @ttl)
      end
    end

    Verse::Shrine::Manager.new(key)
  end

  # Yields the storage for a target. When S3 rejects a target's credentials, the
  # entry is evicted so the next use fetches fresh ones, and the block runs once
  # more. Pass `retriable: false` when the block can't run twice, such as an upload
  # streaming from an IO that can't be rewound: the error is raised after the
  # eviction instead.
  def with_storage(target_id, retriable: true)
    return yield self.for(nil) if target_id.nil?

    retried = false

    begin
      yield self.for(target_id)
    rescue StandardError => e
      raise unless credential_error?(e)

      evict(target_id)
      raise if retried || !retriable

      retried = true
      retry
    end
  end

  # Forget a target's entry, so the next use fetches its credentials again.
  def evict(target_id)
    synchronize { @entries.delete(storage_key(target_id)) }
  end

  def inspect
    "#<#{self.class.name} service=#{@service} targets=#{synchronize { @entries.size }}>"
  end
  alias to_s inspect

  private

  def storage_key(target_id)
    :"target_#{target_id}_#{@service}"
  end

  def build_storage(target_id)
    unless @credentials_provider
      raise TargetUnavailable, "no credentials provider for storage target `#{target_id}`"
    end

    target = @credentials_provider.call(target_id)
    raise TargetUnavailable, "storage target `#{target_id}` not found" unless target

    require "shrine/storage/s3"

    ::Shrine::Storage::S3.new(
      bucket: target.fetch(:bucket),
      access_key_id: target.fetch(:access_key_id),
      secret_access_key: target.fetch(:secret_access_key),
      region: target[:region],
      endpoint: target[:endpoint],
      prefix: folder(target[:prefix]),
      public: false
    )
  end

  # Slashes at either end of the target's prefix would double up in every key.
  def folder(prefix)
    prefix = prefix.to_s.gsub(%r{\A/+|/+\z}, "")
    [prefix, SERVICE_FOLDERS.fetch(@service)].reject(&:empty?).join("/")
  end

  def credential_error?(error)
    error.respond_to?(:code) && CREDENTIAL_ERROR_CODES.include?(error.code.to_s)
  end
end
