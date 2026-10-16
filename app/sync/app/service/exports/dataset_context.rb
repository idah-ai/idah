# frozen_string_literal: true

module Exports
  class DatasetContext
    attr_reader :record

    def initialize(id, entry_ids = nil)
      @record = Api[:idah].dataset.datasets.show(id:)
      @entry_ids = entry_ids
    end

    def entries(filter = {})
      entries_filter = filter.merge(dataset_id: @record.id)
      # When exporting specific entries, restrict to the requested ids only
      # (combined with any status/visibility filter, e.g. completed_entries).
      entries_filter[:id] = @entry_ids if @entry_ids&.any?

      Api[:idah].dataset.entries.index_all(
        filter: entries_filter,
        included: []
      ).map do |entry|
        EntryContext.new(entry)
      end
    end
  end
end
