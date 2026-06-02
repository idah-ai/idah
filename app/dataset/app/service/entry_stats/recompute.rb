# frozen_string_literal: true

module EntryStats
  module Recompute
    StatKeyConflictError = Class.new(StandardError)

    # Recomputes and persists stats for the given entry.
    #
    # 1. Collects core stats via CoreStats.call.
    # 2. Collects plugin stats if a generator is registered for the entry's modality.
    #    Plugin errors are caught and logged; core stats are always persisted.
    # 3. Persists all stats atomically (delete-then-insert in one transaction).
    #
    # @param entry [Entry::Record] entry with dataset, project, and annotations preloaded
    def self.call(entry)
      stats = EntryStats::CoreStats.call(entry)

      begin
        collect_plugin_stats(entry, stats)
      rescue StandardError => e
        Verse.logger.error(
          "[EntryStats] Plugin generator for modality '#{entry.dataset.modality}' " \
          "failed: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        )
      end

      persist(entry.id, stats)
    end

    # Builds the emit lambda, calls the registered generator, and merges plugin stats
    # into the shared stats hash only when the generator completes without error.
    def self.collect_plugin_stats(entry, stats)
      modality = entry.dataset.modality
      klass = EntryStats::Registry.get(modality)

      Verse.logger.debug{ "[EntryStats] Plugin lookup — modality='#{modality}' generator=#{klass || "none"}" }

      return unless klass

      plugin_stats = {}

      emit = lambda do |key, value|
        key_s = key.to_s

        if stats.key?(key_s)
          raise StatKeyConflictError,
                "Cannot override existing core stat key '#{key_s}'"
        end

        if plugin_stats.key?(key_s)
          raise StatKeyConflictError,
                "Duplicate emit for stat key '#{key_s}' within the same generator"
        end

        plugin_stats[key_s] = value.to_s
      end

      klass.generate(entry, emit)
      stats.merge!(plugin_stats)
    end

    # Deletes all existing stats for the entry and inserts the new set in one transaction.
    def self.persist(entry_id, stats)
      repo = EntryStat::Repository.new(nil)
      repo.transaction do
        repo.delete_by_entry_id(entry_id)
        repo.bulk_insert(entry_id, stats)
      end
    end
  end
end
