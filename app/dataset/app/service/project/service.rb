# frozen_string_literal: true

module Project
  class Service < Verse::Service::Base
    use projects: Project::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      projects.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      projects.find!(id, included: included)
    end

    def create(record)
      authorize_creation(
        record.attributes[:organization_id].to_s,
        auth_context.can?(:create, projects.class.resource)
      )

      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:created_by_email] = auth_context.metadata[:email]

      projects.transaction do
        id = projects.create(attributes)
        projects.find!(id)
      end
    end

    def authorize_creation(organization_id, access)
      authorized = access == :all ||
                   # is in scope of org_owner
                   (access == :as_org_owner && auth_context.custom_scopes[:org]&.include?(organization_id))

      raise Verse::Error::Unauthorized, "You do not have permission to create this project" unless authorized
    end

    def update(record)
      projects.update!(record.id, record.attributes)
      projects.find!(record.id)
    end

    def delete(id)
      projects.delete!(id)
    end
  end
end
