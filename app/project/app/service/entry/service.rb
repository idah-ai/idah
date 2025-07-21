# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      entries.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      entries.find!(id, included: included)
    end

    def create(attributes)
      id = entries.create(attributes)
      entries.find!(id)
    end

    def update(record)
      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      entries.delete(id)
    end
  end
end
