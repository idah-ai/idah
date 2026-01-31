module Export
  class EntryContext
    attr_reader :id

    def initialize(id)
      @id = id
    end

    def annotations
      # Fetch annotations for given entry
      break_next_page = false
      items_per_page = 25

      Verse::Util::Iterator.chunk_iterator(1) do |current_page|
        next nil if break_next_page

        result = Api[:idah].dataset.annotations.index(
          filter: {
            entry_id: @id
          },
          page: {
            number: current_page, size: items_per_page
          },
          included: ["project_members"]
        )

        break_next_page = result.count < items_per_page

        result.count == 0 ? nil : result
      end
    end
  end
end
