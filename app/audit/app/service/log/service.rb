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

    def create(message)
      service, type, action = message.event.split(":")

      logs.transaction do
        id = logs.create(
          {
            actor_account_id: message.content[:metadata][:account_id],
            action: action,
            resource_service: service,
            resource_type: type,
            resource_id: message.content[:resource_id],
            event_timestamp: message.content[:metadata][:at],
          }
        )
        logs.find!(id)
      end
    end
  end
end
