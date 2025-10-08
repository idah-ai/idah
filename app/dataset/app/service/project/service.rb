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
      created_project = projects.find!(id)

      # add the current user as project member automatically ?
      project_member_service.create(
        Verse::JsonApi::Struct.new(
          {
            type: ProjectMember::Repository.resource,
            # id: updated_attributes[:query_id],
            attributes: {
              # TODO: review project member attrs
              project_id: created_project.id,
              account_id: auth_context.metadata[:id] || created_project.created_by_id,
              name: auth_context.metadata[:name] || nil,
              email: auth_context.metadata[:email] || "",
              invited_by_id: auth_context.metadata[:id] || created_project.created_by_id,
            },
          }
        )
      )

      created_project
    end

    def update(record)
      projects.update!(record.id, record.attributes)
      projects.find!(record.id)
    end

    def delete(id)
      projects.delete(id)
    end
  end
end
