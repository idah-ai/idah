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
      attr = record.attributes

      if record.project
        attr[:project_id] = record.project.id
      else
        raise Verse::Error::ValidationFailed,
              "project is required to create a dataset"
      end

      # Ensure user can "create" member to the project
      unless project_members.account_can_access_project?(attr[:project_id], :create)
        raise Errors::Service::UnauthorizedProjectAccess
      end

      project_members.transaction do
        id = project_members.create(attr)
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
