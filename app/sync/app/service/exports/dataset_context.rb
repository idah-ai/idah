module Exports
  class DatasetContext
    def initialize(id)
      @id = id
    end

    def info
      # Dataset info
    end

    def entries
      Api[:idah].dataset.entries.index_all(
        filter: { dataset_id: @id },
        included: []
      ).map do |entr|
        EntryContext.new(entr.id)
      end
    end

  end
end
