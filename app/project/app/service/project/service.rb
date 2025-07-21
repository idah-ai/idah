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

    def create(attributes)
      attributes[:created_by_id] = auth_context.metadata[:id]
      id = projects.create(attributes)
      projects.find!(id)
    end

    def update(record)
      projects.update(record.id, record.fields.except(:id, :created_at, :updated_at))
      projects.find!(record.id)
    end

    def delete(id)
      projects.delete(id)
    end
  end
end
