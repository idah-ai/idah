# frozen_string_literal: true

module EntryStats
  class Service < Verse::Service::Base
    use entry_stats: EntryStat::Repository
    use_system system_entries: Entry::Repository
    use_system system_datasets: Dataset::Repository

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

    def recompute_all_for_dataset(dataset_id, removed_category_ids: [])
      removed_set = removed_category_ids.to_set
      system_datasets.update!(dataset_id, { syncing_stats: true })

      entries = system_entries.chunked_index({ dataset_id__eq: dataset_id }, included: [:dataset, :annotations])
      entries.each do |entry|
        if %w[completed errored].include?(entry.status)
          EntryStats::Recompute.call(entry)
        elsif %w[pending in_progress].include?(entry.status)
          live_annotations = (entry.annotations || []).reject(&:deleted_at)
          next unless live_annotations.any? { |a| removed_set.include?(a.category) }

          EntryStats::Recompute.orphan_only(entry)
        end
      end
    ensure
      system_datasets.update!(dataset_id, { syncing_stats: false })
    end
  end
end
