# frozen_string_literal: true

class StorageRegistry
  # Drops a storage target's cached storage in every process when the target
  # changes, so new credentials are used at once. Broadcast mode:
  # `on_resource_event` would reach only one process per service. The registry's
  # TTL covers a missed message.
  #
  # Registered in media and sync, which store files in the targets.
  class EvictionExpo < Verse::Exposition::Base
    extend ProjectMembership::BroadcastHook

    expose on_resource_broadcast(Resource::Setting::StorageTargets, "updated")
    def on_storage_target_updated
      evict
    end

    expose on_resource_broadcast(Resource::Setting::StorageTargets, "deleted")
    def on_storage_target_deleted
      evict
    end

    private

    def evict
      target_id = message.content[:resource_id]
      StorageRegistry.evict(target_id) if target_id
    end
  end
end
