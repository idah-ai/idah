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

      project_members.transaction do
        id = project_members.create(attr)
        
        project_member = project_members.find(id, scope: project_members.scoped(:create))

        raise Errors::Service::UnauthorizedProjectAccess unless project_member

        project_member
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
