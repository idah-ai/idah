# frozen_string_literal: true

module ProjectMembership
  # A broadcast-mode resource event subscription hook, for cache invalidation.
  #
  # `on_resource_event` subscribes in consumer mode, which delivers each event to
  # only ONE process per service — so only one worker's cache would be
  # invalidated. verse-redis publishes every resource event both to a stream and
  # to the fire-and-forget pub/sub channel `VERSE:RESOURCE:<resource>:<event>`;
  # a broadcast-mode subscription receives it in every process. Pub/sub has no
  # replay, which is fine for cache invalidation (a missed message leaves a stale
  # entry until the next invalidation or process restart).
  module BroadcastHook
    # Subscribes to a resource event in broadcast mode. Returns an
    # `EventBus` whose `type` is MODE_BROADCAST, so `subscribe_resource_event`
    # registers a broadcast (pub/sub) subscription for the resource event.
    def on_resource_broadcast(resource, event, **opts)
      Verse::Exposition::Hook::EventBus.new(
        self,
        resource_channel: [resource, event],
        type: Verse::Event::Manager::MODE_BROADCAST,
        **opts
      )
    end
  end
end