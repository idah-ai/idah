module Export
  class EntryContext
    attr_reader :id

    def initialize(id)
      @id = id
    end

    def annotations
      # Fetch annotations for given entry
    end
  end
end
