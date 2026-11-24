# frozen_string_literal: true

require "monitor"

# Storage targets as the setting service serves them to the system role, without
# their secret: what a project needs to check it may use one, and to show it.
#
# Answers are kept for a minute, which is enough for showing projects; a project
# creation asks with `fresh: true`, so a target disabled a moment ago is refused.
# Nil means setting doesn't serve the target: unknown, or archived.
class StorageTargetLookup
  Target = Data.define(:id, :name, :endpoint, :bucket, :enabled, :organization_ids)

  TTL = 60 # seconds
  CAPACITY = 1_000

  @lock = Monitor.new
  @entries = {}

  class << self
    def find(id, fresh: false)
      now = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      unless fresh
        cached = @lock.synchronize { @entries[id] }
        return cached[:target] if cached && cached[:expires_at] > now
      end

      target = fetch(id)

      @lock.synchronize do
        @entries.clear if @entries.size >= CAPACITY
        @entries[id] = { target:, expires_at: now + TTL }
      end

      target
    end

    # For specs.
    def reset!
      @lock.synchronize { @entries.clear }
    end

    private

    def fetch(id)
      record = Api[:idah].setting.storage_targets.show(id:)
      attributes = record.attributes || {}

      Target.new(
        id: record.id.to_s,
        name: attributes[:name],
        endpoint: attributes[:endpoint],
        bucket: attributes[:bucket],
        enabled: attributes[:enabled] == true,
        organization_ids: Array(attributes[:organization_ids]).map(&:to_i)
      )
    rescue Api::HTTPError => e
      raise unless e.status == 404

      nil
    end
  end
end
