# frozen_string_literal: true

module EntryStats
  class Service < Verse::Service::Base
    use entry_stats: EntryStat::Repository
    use_system system_entries: Entry::Repository,
               system_datasets: Dataset::Repository,
               system_entry_stats: EntryStat::Repository

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

    def recompute_from_annotation(entry_id)
      ## need to fix after handling orphan categories correctly
      return unless system_entry_stats.orphan_category(entry_id)
      # binding.pry
      entry = system_entries.find!(entry_id, included: [:dataset, :annotations])
      EntryStats::Recompute.orphan_only(entry)
    end

    def recompute_all_for_dataset(dataset_id, changed_category_ids: [])
      changed_set = changed_category_ids.to_set

      entries = system_entries.chunked_index({ dataset_id__eq: dataset_id }, included: [:dataset, :annotations])
      entries.each do |entry|
        # Only recompute entries that have annotations matching a changed
        # category. If changed_set is empty (no IDs changed), every entry is
        # skipped and the sweep finishes instantly — no unnecessary recomputes.
        live_annotations = (entry.annotations || []).reject(&:deleted_at)
        next unless live_annotations.any? { |a| changed_set.include?(a.category) }

        if %w[completed errored].include?(entry.status)
          EntryStats::Recompute.call(entry)
        elsif %w[pending in_progress].include?(entry.status)
          EntryStats::Recompute.orphan_only(entry)
        end
      rescue StandardError => e
        Verse.logger.error(
          "[EntryStats] Failed to recompute stats for entry #{entry.id} " \
          "(dataset #{dataset_id}): #{e.message}"
        )
      end
    ensure
      entry_stats.no_event { system_datasets.update!(dataset_id, { syncing_stats: false }) }
    end
  end
end
