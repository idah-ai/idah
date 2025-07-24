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

    def create(attributes)
      id = datasets.create(attributes)
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
