# frozen_string_literal: true

module Log
  class Service < Verse::Service::Base
    use logs: Log::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      logs.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      logs.find!(id, included: included)
    end

    def create(attributes)
      logs.transaction do
        id = logs.create(attributes)
        logs.find!(id)
      end
    end

    # Creates a log entry from an event message.
    # Returns the created record, or nil if the event should be skipped
    # (e.g. missing event_timestamp).
    # Never raises — exceptions are caught and logged to prevent message loss
    # (the verse-core event bus uses noack: true on Redis streams).
    def create_from_message(message:, **additional_attributes)
      attrs = build_attributes_from_message(message:, **additional_attributes)
      return unless attrs

      create(attrs)
    rescue StandardError => e
      Verse.logger&.error{ "Log::Service: error processing #{message.event}: #{e.message}" }
      Verse.logger&.error(e)
      nil
    end

    private

    def build_attributes_from_message(message:, **additional_attributes)
      service_name, type, action = message.event.split(":")
      content = message.content || {}
      metadata = content[:metadata] || {}
      resource_id = content[:resource_id]

      unless metadata[:at]
        Verse.logger&.warn{ "Log::Service: skipping event #{message.event} — missing event_timestamp (metadata[:at])" }
        return
      end

      attributes = {
        action: action,
        resource_service: service_name,
        resource_type: type,
        resource_id: resource_id,
        event_timestamp: metadata[:at],
        actor_account_id: metadata[:actor_account_id],
        actor_account_email: metadata[:actor_account_email],
        actor_account_role_name: metadata[:actor_account_role_name],
      }

      attributes.merge(additional_attributes)
    end
  end
end
