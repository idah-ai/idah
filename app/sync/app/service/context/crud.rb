module Context
  class Crud < Base
    def create(attributes = {})
      raise :not_implemented
    end

    def index(filters = {})
      if Hash(@opts)[:delegated]
        @context_api.index(merge_filters(filters))
      else
        Verse::Util::Iterator.chunk_iterator(1) do |number|
          query_result = @context_api.index(
            filter: merge_filters(filters),
            page: {number:, size: 100})

          raise query_result.errors if query_result.errors

          query_result.data if !query_result.data.empty?
        end.lazy.map(&:data).map do |record|
          @context_builder.call(record)
        end
      end
    end

    def show(id = nil)
      filters = merge_filters(id ? {id:} : nil)

      if Hash(@opts)[:delegated]
        @context_api.show(filters[:id])
      else
        raise Verse::Error::NotFound if !filters[:id] || (id && filters[:id] != id) # overriden by context

        query_result = @context_api.index(filters:, page: {number: 1, size: 1})
        raise query_result.errors if query_result.errors

        raise Verse::Error::NotFound, id if query_result.data.empty?

        record = query_result.data.first.data
        @context_builder.call(record)
      end
    end

    def update(attributes, id = nil)
      raise :not_implemented
    end

    def delete(id = nil)
      raise :not_implemented
    end
  end
end
