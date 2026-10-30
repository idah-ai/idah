# frozen_string_literal: true

module Exports
  class DatasetContext
    attr_reader :record

    def initialize(id, entry_ids = nil)
      @record = Api[:idah].dataset.datasets.show(id:)
      @entry_ids = entry_ids
    end

    def entries(filter = {})
      # Batch the requested ids into chunks so the lookup doesn't exceed URL
      # length limits
      id_batches = @entry_ids&.any? ? @entry_ids.each_slice(100) : [nil]

      id_batches.flat_map do |slice|
        batch_filter = filter.merge(dataset_id: @record.id)
        # When exporting specific entries, restrict to the requested ids only
        # (combined with any status/visibility filter, e.g. completed_entries).
        batch_filter[:id] = slice if slice

        Api[:idah].dataset.entries.index_all(
          filter: batch_filter,
          included: []
        ).map do |entry|
          EntryContext.new(entry)
        end
      end
    end
  end
end
