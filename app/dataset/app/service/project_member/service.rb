# frozen_string_literal: true

module ProjectMember
  class Service < Verse::Service::Base
    use project_members: ProjectMember::Repository,
        project_service: Project::Service

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
      # # TODO: remove mocking
      account_id = auth_context.metadata[:id] || 1
      project_id = record.attributes[:project_id]

      auth_context.reject! unless project_service.own?(account_id, project_id)

      project_members.transaction do
        record_id = project_members.create(record.attributes)
        project_members.find!(record_id)
      end
    end

    def update(record)
      project_members.update!(record.id, record.attributes)
      project_members.find!(record.id)
    end

    def delete(id)
      project_members.delete(id)
    end
  end
end
