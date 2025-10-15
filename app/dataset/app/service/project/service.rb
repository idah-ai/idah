# frozen_string_literal: true

module Project
  class Service < Verse::Service::Base
    use projects: Project::Repository,
        project_member_service: ProjectMember::Service

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
      attr = record.attributes
      attr[:id] = record.id || UUIDv7.generate

      id = projects.create(attr)

      account_id = auth_context.metadata[:id] || 1 # TODO: remove, mocking

      # add the user creating as project member automatically
      project_member_service.create(
        Verse::JsonApi::Struct.new(
          {
            type: ProjectMember::Repository.resource,
            # id: updated_attributes[:query_id],
            attributes: {
              # TODO: review project member attrs and remove mockings
              project_id: id,
              account_id: account_id,
              name: auth_context.metadata[:name] || nil, # TODO: fetch either from context or iam account
              email: auth_context.metadata[:email] || "", # TODO: fetch either from context or iam account
              invited_by_id: account_id,
              created_by_id: account_id,
              permission_set: "owner",
            },
          }
        )
      )

      projects.find!(id)
    end

    def update(record)
      # TODO: remove mocking
      account_id = auth_context.metadata[:id] || 1
      project_id = record.id
      role = ProjectMember::Repository.new(auth_context).get_permission_set(account_id, project_id)

      auth_context.reject! unless auth_context.can!(:update, Resource::Dataset::Projects) do |scope|
        scope.all? { true }
        scope.as_user? { owner?(role) }
      end

      projects.update!(project_id, record.attributes)
      projects.find!(record.id)
    end

    def delete(id)
      # TODO: remove mocking
      account_id = auth_context.metadata[:id] || 1
      project_id = id
      role = ProjectMember::Repository.new(auth_context).get_permission_set(account_id, project_id)

      auth_context.reject! unless auth_context.can!(:delete, Resource::Dataset::Projects) do |scope|
        scope.all? { true }
        scope.as_user? { owner?(role) }
      end

      projects.delete(id)
    end
  end
end
