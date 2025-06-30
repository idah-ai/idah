# frozen_string_literal: true

module Medias
  class Service < Verse::Service::Base
    use Medias::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      repo.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, _key, included: [])
      repo.find!(id, included:)
    end

    def delete(id)
      repo.delete(id)
    end

    def create(record)
      repo.transaction do
        record_id = repo.create(record.attributes)
        repo.find!(record_id)
      end
    end
  end
end
