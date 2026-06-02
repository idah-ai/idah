# frozen_string_literal: true

module EntryStats
  class Service < Verse::Service::Base
    use entry_stats: EntryStat::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      entry_stats.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      entry_stats.find!(id, included: included)
    end
  end
end
