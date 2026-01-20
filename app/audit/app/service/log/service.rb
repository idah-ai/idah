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
      resource_service, resource_type, action = event.split(":")
      resource_id = content[:resource_id]
      metadata = content[:metadata]

      attributes = general_log_attributes(resource_service:, resource_type:, action:, resource_id:, metadata:)
                   .merge(service_resource_ids(resource_type:, resource_id:, metadata:))

      logs.transaction do
        id = logs.create(attributes)
        logs.find!(id)
      end
    end

    private

    # general info for all audit logs regardless of resources
    def general_log_attributes(resource_service:, resource_type:, action:, resource_id:, metadata:)
      {
        resource_service:,
        resource_type:,
        action:,
        resource_id: resolve_resource_id(resource_type:, resource_id:, metadata:),
        event_timestamp: metadata[:at],
        actor_account_id: metadata[:actor_account_id],
        actor_account_email: metadata[:actor_account_email],
        actor_account_role_name: metadata[:actor_account_role_name]
      }
    end

    # custom cases to override resource_id field with other information
    RESOURCE_ID_OVERRIDES = {
      "account_sessions" => :actor_account_email,
      "medias" => :media_resource
    }.freeze

    def resolve_resource_id(resource_type:, resource_id:, metadata:)
      if override_field = RESOURCE_ID_OVERRIDES[resource_type]
        metadata[override_field]
      else
        resource_id
      end
    end

    # resource types - id field mappings
    SERVICE_RESOURCE_ID_MAPPINGS = {
      "organizations" => :organization_id,
      "projects" => :project_id,
      "datasets" => :dataset_id,
      "entries" => :entry_id
    }.freeze

    # use resource_id for the current based event resource, e.g. if it's a project event,
    # - project_id can be found in resource_id,
    # - then it can be found in metadata[:project_id] otherwise
    def service_resource_ids(resource_type:, resource_id:, metadata:)
      service_resource_ids = {}

      SERVICE_RESOURCE_ID_MAPPINGS.each_value do |id_field|
        service_resource_ids[id_field] =
          id_field == SERVICE_RESOURCE_ID_MAPPINGS[resource_type] ? resource_id : metadata[id_field]
      end

      service_resource_ids
    end
  end
end
