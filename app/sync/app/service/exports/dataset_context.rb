module Exports
  class DatasetContext
    def initialize(id)
      @id = id
    end

    def info
      # Dataset info
    end

    def entries
      break_next_page = false
      items_per_page = 25

      Verse::Util::Iterator.chunk_iterator(1) do |current_page|
        next nil if break_next_page

        result = Api[:idah].dataset.entries.index(
          filter: { dataset_id: @id },
          page: {
            number: current_page, size: items_per_page
          },
          included: []
        ).map do |entr|
          EntryContext.new(entr.id)
        end

        break_next_page = result.count < items_per_page

        result.count == 0 ? nil : result
      end
    end
  end
end
