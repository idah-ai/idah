# frozen_string_literal: true

module Exports
  class DatasetContext
    attr_reader :record

    def initialize(id)
      @record = Api[:idah].dataset.datasets.show(id:)
    end

    def entries(filter = {})
      Enumerator.new do |yielder|
        Api[:idah].dataset.entries.index_all(
          filter: filter.merge(dataset_id: @record.id),
          included: []
        ).each do |page|
          page.each { |entry| yielder << EntryContext.new(entry) }
        end
      end
    end
  end
end
