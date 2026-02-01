module Exports
  class EntryContext
    attr_reader :id

    def initialize(id)
      @id = id
    end

    def annotations
      Api[:idah].dataset.annotations.index_all(
        filter: {
          entry_id: @id
        },
        included: ["project_members"]
      )
    end
  end
end
