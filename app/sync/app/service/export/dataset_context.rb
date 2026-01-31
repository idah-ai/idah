module Export
  class DatasetContext
    def initialize(id)
      @id = id
    end

    def info
      # Dataset info
    end

    def entries
      Enumerator.new do |yielder|
        # Chunk API iterator through entries
      end
    end
  end
end
