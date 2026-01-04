module Context
  class Crud < Base
    DEFAULT_BATCH_SIZE = 100
    include Enumerable
    def each(&block)
      return index.each unless block_given?

      index.each do |unit|
        yield unit
      end
    end

    def create(attributes = nil)
      raise NotImplementedError
    end

    def index(filters = nil, **opts)
      @context_api.index(
        build_filters(filters),
        **opts
      )
    end

    def show(id = nil)
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

      Verse::logger.debug {{lazy: query_result.is_a?(Enumerator::Lazy)}}
      record = if query_result.is_a? Enumerator::Lazy
        query_result.first
      else
        raise Context::Error::QueryFailed, query_result.errors if query_result.errors
        raise Context::Error::NotFound, id if query_result.data.empty?

        query_result.data.first.data
      end
      Verse::logger.debug{{ record: }}

      @context_builder&.call(record) || builder(record)
    end

    def update(attributes, id = nil)
      raise NotImplementedError
    end

    def delete(id = nil)
      raise NotImplementedError
    end
  end
end
