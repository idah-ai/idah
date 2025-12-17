module Context
  module ContextApi
    class Crud < Base
      def create(attributes = {})
        raise :not_implemented
      end

      def index(filters = {})
        Verse::logger::debug {[:index, @context_api.name, filters, @context_filters, @opts].join(" ")}
        if Hash(@opts)[:loopback]
          Verse::logger::debug {{loopback_index: {self: self, filters:, loopback: Hash(@opts)[:loopback]}}}
          Hash(@opts)[:loopback].index(merge_filters(filters))
        else
          Verse::Util::Iterator.chunk_iterator(1) do |number|
            query_result = @context_api.index(
              filter: merge_filters(filters),
              page: {number:, size: 100})

            raise query_result.errors if query_result.errors

            query_result.data if !query_result.data.empty?
          end.lazy.map(&:data).map do |record|
            Verse::logger.debug {{record:}}
            @context_builder.call(record)
          end
        end
      end

      def show(id = nil)
        Verse::logger::debug {[:show, @context_api.name, id, @opts].join(" ")}
        filters = merge_filters(id ? {id:} : nil)

        if Hash(@opts)[:loopback]
          Verse::logger.debug {{self: self, filters:, opts: @opts}}
          Hash(@opts)[:loopback].show(filters[:id])
        else
          raise Verse::Error::NotFound if !filters[:id] || (id && filters[:id] != id) # overriden by context

          query_result = @context_api.index(filters:, page: {number: 1, size: 1})
          raise query_result.errors if query_result.errors

          raise Verse::Error::NotFound, id if query_result.data.empty?

          record = query_result.data.first.data
          Verse::logger.debug {{self: self, filters:, record:}}
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
end
