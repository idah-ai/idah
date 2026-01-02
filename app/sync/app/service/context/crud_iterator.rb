module Context
  DEFAULT_BATCH_SIZE = 100
  class CrudIterator < Crud
    include Enumerable
    def map(&block)
      return index.lazy.map unless block_given?

      index.lazy.map(&block)
    end

    def each(&block)
      return index.each unless block_given?

      index.each(&block)
    end

    # Returns a lazy enumerator of records
    # For Delegate contexts: delegates directly
    # For API contexts: paginates through results automatically
    def index(filters = {})
      Verse::logger.debug {[self.class.name, :index].join("#")}
      Verse::Util::Iterator.chunk_iterator(1) do |number|
        query_result = @context_api.index(
          filter: build_filters(filters),
          page: { number:, size: @opts[:page_size] || DEFAULT_BATCH_SIZE }
        )

        raise Context::Error::QueryFailed, query_result.errors if query_result.errors

        # Return nil when empty to stop iteration
        query_result.data unless query_result.data.empty?
      end.lazy.map(&:data).map do |record|
        @context_builder&.call(record) || builder(record)
      end
    end

    def show(id = nil)
      Verse::logger.debug {[self.class.name, :show].join("#")}
      filters = build_filters(id ? { id: } : nil)
      # Validate that an ID is present after filter merging
      unless filters[:id]
        raise Context::Error::NotFound, "No ID available after applying context filters"
      end

      # Security check: if user provided an ID but context changed it
      if id && filters[:id] != id
        raise Context::Error::Forbidden, "Context does not permit access to resource #{id}"
      end

      query_result = @context_api.index(filters:, page: { number: 1, size: 1 })
      raise Context::Error::QueryFailed, query_result.errors if query_result.errors
      raise Context::Error::NotFound, id if query_result.data.empty?

      record = query_result.data.first.data
      @context_builder&.call(record) || builder(record)
    end
  end
end
