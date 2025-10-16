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
      # TODO: remove mocking
      account_id = auth_context.metadata[:id] || 1
      project_id = record.attributes[:project_id]

      auth_context.reject! unless project_service.own?(account_id, project_id)

      project_members.transaction do
        record_id = project_members.create(record.attributes)
        project_members.find!(record_id)
      end
    end

    def update(record)
      # TODO: consider if we should allow update, and what role if so
      project_members.update!(record.id, record.attributes)
      project_members.find!(record.id)
    end

    def delete(id)
      account_id = auth_context.metadata[:id] || 1
      membership = project_members.find(id)
      role = membership.permission_set

      auth_context.reject! unless auth_context.can!(:delete, Resource::Dataset::ProjectMembers) do |scope|
        scope.all? { true }
        scope.as_user? { owner?(role) || self?(account_id, membership.account_id) }
      end

      project_members.delete(id)
    end
  end
end
