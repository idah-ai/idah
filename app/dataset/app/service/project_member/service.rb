# frozen_string_literal: true

module ProjectMember
  class Service < Verse::Service::Base
    use project_members: ProjectMember::Repository,
        projects: Project::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      project_members.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      project_members.find!(id, included: included)
    end

    def create(record)
      # Validate required relationships
      unless record.project
        raise Verse::Error::ValidationFailed,
              "project relationship is required to create a project member"
      end

      access = auth_context.can?(:create, project_members.class.resource)

      # With "as_user" access ensure account can "create" project member to the project
      if access == :as_user && !ScopedQuery::Service.with_project_access?(
        auth_context.metadata[:id],
        record.project.id,
        ["project_owner"]
      )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create project member on this project"
      end

      # "project_owner" can only be added by an org_owner of the project
      if access == :as_org_owner || record.attributes[:role] == "project_owner"
        project = projects.find!(record.project.id) # this can raise Verse::Error::RecordNotFound if not in org scope

        unless auth_context.custom_scopes[:org]&.include?(project.organization_id)
          raise Verse::Error::Unauthorized,
                "You do not have permission to create a project owner member for this project"
        end
      end

      # Assign attributes
      attributes = record.attributes
      attributes[:project_id] = record.project.id

      project_members.transaction do
        id = project_members.create(attributes)
        project_members.find(id)
      end
    end

    def update(record)
      project_members.update!(record.id, record.attributes)
      project_members.find!(record.id)
    end

    def delete(id)
      project_members.delete!(id)
    end
  end
end
