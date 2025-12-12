module Context
  module IdahApi
    class ContextApi
      def initialize(context_builder, context_api, context_filters, args, api = Api[:idah])
        @context_builder = context_builder
        @context_api = context_api
        @context_filters = context_filters
        @args = args
        @api = api
      end

      def index(filters = {})
        Verse::Util::Iterator.chunk_iterator(1) do |number|
          query_result = @context_api.index(
            filters: Hash(filters).merge(
              Hash(@args).slice(@context_api.name)).merge(@context_filters),
            page: {number:, size: 100})

          raise query_result.errors if query_result.errors

          query_result.data if !query_result.data.empty?
        end.lazy.map(&:data).map do |record|
          @context_builder.call(record, @args, @api)
        end
      end

      def show(id)
        filters = {id:}.merge(@context_filters).merge(Hash(args).slice(@context_api.name))
        raise Verse::Error::NotFound if filters[:id] != id # overriden by context

        query_result = @context_api.index(filters:, page: {number: 1, size: 1})
        raise query_result.errors if query_result.errors

        raise Verse::Error::NotFound, id if query_result.data.empty?

        record = query_result.data.first.data
        @context_builder.call(record, @args, @api)
      end
    end
  end
end