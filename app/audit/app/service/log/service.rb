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

    def create_from_event(event, content)
      service, type, action = event.split(":")
      resource_id = content[:resource_id]
      metadata = content[:metadata]

      logs.transaction do
        id = logs.create(
          {
            # usually included in message
            action: action,
            resource_service: service,
            resource_type: type,
            resource_id: resource_id,
            event_timestamp: metadata[:at],
            # added metadata
            actor_account_id: metadata[:actor_account_id],
            actor_account_email: metadata&.[](:actor_account_email),
            actor_account_role_name: metadata&.[](:actor_account_role_name),
            organization_id: type == "organizations" ? resource_id : metadata&.[](:organization_id),
            project_id: type == "projects" ? resource_id : metadata&.[](:project_id),
            dataset_id: type == "datasets" ? resource_id : metadata&.[](:dataset_id),
            entry_id: type == "entries" ? resource_id : metadata&.[](:entry_id)
          }
        )
        logs.find!(id)
      end
    end
  end
end
