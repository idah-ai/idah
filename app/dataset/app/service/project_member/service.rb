# frozen_string_literal: true

module ProjectMember
  class Service < Verse::Service::Base
    use project_members: ProjectMember::Repository

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

      # Ensure user can "create" member to the project
      unless project_members.account_can_access_project?(record.project.id, :create)
        raise Errors::Service::UnauthorizedProjectAccess
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
