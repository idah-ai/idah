module Context
  module ContextApi
    class Base
      def initialize(context_builder, context_api, context_filters, args, api = :idah)
        @context_builder = context_builder
        @context_api = context_api
        @context_filters = context_filters
        @args = args
        @api = api
      end

      protected
      def merge_filters(filters)
        Hash(filters)
          .merge(@context_filters)
          .merge(Hash(@args).slice(@context_api.name))
      end
    end
  end
end