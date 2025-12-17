module Context
  module ContextApi
    class Base
      attr_reader :context_filters, :args, :opts

      def initialize(
        context_api,
        api = :idah,
        args = {},
        context_filters = {},
        opts = {},
        context_builder = Proc.new {|record| record}
      )
        Verse::logger.debug([@context_api_name, args, context_filters, opts].join(" "))
        @api = api
        @args = args
        @context_api = context_api
        @context_builder = context_builder
        @context_filters = context_filters
        @opts = {}
      end
      protected
      def merge_filters(filters = {}, context_api_name = @context_api.name)
        Hash(filters)
          .merge(Hash(Hash(@context_filters)[context_api_name]))
          .merge(Hash(Hash(@args)[context_api_name]))
      end

      def merge_context_filters(filters = {}, context_api_name = @context_api.name)
        Hash(@context_filters).merge([[context_api_name, merge_filters(filters, context_api_name)]].to_h)
      end
    end
  end
end
