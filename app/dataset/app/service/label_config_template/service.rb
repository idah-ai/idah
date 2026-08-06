# frozen_string_literal: true

module LabelConfigTemplate
  class Service < Verse::Service::Base
    use templates: LabelConfigTemplate::Repository
    use_system system_project_members: ProjectMember::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      templates.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      templates.find!(id, included: included)
    end

    def create(record)
      organization_id = record.attributes[:organization_id]

      authorize_creation(
        organization_id,
        auth_context.can?(:create, templates.class.resource)
      )

      account_id = auth_context.metadata[:id]
      attributes = record.attributes
      attributes[:created_by_id] = account_id
      attributes[:updated_by_id] = account_id

      templates.transaction do
        id = templates.create(attributes)
        templates.find!(id)
      end
    end

    def update(record)
      attributes = record.attributes
      attributes[:updated_by_id] = auth_context.metadata[:id]

      templates.update!(record.id, attributes)
      templates.find!(record.id)
    end

    def delete(id)
      templates.delete!(id)
    end

    private

    def authorize_creation(organization_id, access)
      authorized =
        access == :all ||
        # org_owner can create within their own organizations
        (access == :as_org_owner &&
          auth_context.custom_scopes[:org]&.include?(organization_id.to_s)) ||
        # project_owner can create within organizations they own a project in
        (access == :as_user && project_owner_in_organization?(organization_id))

      raise Verse::Error::Unauthorized, "You do not have permission to create this template" unless authorized
    end

    def project_owner_in_organization?(organization_id)
      members = system_project_members.index(
        {
          account_id: auth_context.metadata[:id],
          role: "project_owner",
          enabled: "true",
          organization_id__in: [organization_id]
        },
        items_per_page: 1
      )

      members.any?
    end
  end
end
