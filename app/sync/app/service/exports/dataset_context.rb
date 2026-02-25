# frozen_string_literal: true

module Exports
  class DatasetContext
    attr_reader :dataset

    def initialize(id)
      @dataset = Api[:idah].dataset.datasets.show(id:)
    end

    def entries
      Api[:idah].dataset.entries.index_all(
        filter: { dataset_id: @dataset.id },
        included: []
      ).map do |entry|
        EntryContext.new(entry)
      end
    end
  end
end
