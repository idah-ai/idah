# frozen_string_literal: true

module Annotation
  class Service < Verse::Service::Base
    use annotations: Annotation::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      annotations.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      annotations.find!(id, included: included)
    end

    def create(attributes)
      id = annotations.create(attributes)
      annotations.find!(id)
    end

    def update(record)
      annotations.update!(record.id, record.attributes)
      annotations.find!(record.id)
    end

    def delete(id)
      annotations.delete(id)
    end
  end
end
