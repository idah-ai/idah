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

    def create(record)
      attr = record.attributes
      attr[:id] = record.id || UUIDv7.generate

      projects.transaction do
        id = projects.create(attr)
        projects.find!(id)
      end
    end

    def update(record)
      projects.update!(record.id, record.attributes)
      projects.find!(record.id)
    end

    def delete(id)
      projects.delete!(id)
    end
  end
end
