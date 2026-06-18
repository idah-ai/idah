# frozen_string_literal: true

module EntryStats
  class Service < Verse::Service::Base
    use entry_stats: EntryStat::Repository
    use_system system_entries: Entry::Repository

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

    def recompute(entry_id)
      entry = system_entries.find!(entry_id, included: [:dataset, :annotations])
      EntryStats::Recompute.call(entry)
    end
  end
end
