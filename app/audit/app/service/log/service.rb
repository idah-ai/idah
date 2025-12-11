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

    def create(event, content)
      service, type, action = event.split(":")

      logs.transaction do
        id = logs.create(
          {
            actor_account_id: content[:metadata][:account_id],
            action: action,
            resource_service: service,
            resource_type: type,
            resource_id: content[:resource_id],
            event_timestamp: content[:metadata][:at],
          }
        )
        logs.find!(id)
      end
    end
  end
end
