# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      datasets.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      datasets.find!(id, included: included)
    end

    def create(record)
      attr = record.attributes

      # attr[:created_by_id] ||= auth_context.metadata[:id]
      attr[:id] =  record.id || UUIDv7.generate

      if record.project
        attr[:project_id] = record.project.id
      else
        raise Verse::Error::ValidationFailed,
          "project is required to create a dataset"
      end

      id = datasets.create(
        record.attributes
      )

      datasets.find!(id)
    end

    def update(record)
      datasets.update!(record.id, record.attributes)
      datasets.find!(record.id)
    end

    def delete(id)
      datasets.delete(id)
    end
  end
end
