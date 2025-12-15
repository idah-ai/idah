module Context
  module ContextApi
    class Base
      def initialize(
        context_api,
        api = :idah,
        args = {},
        context_filters = {},
        context_builder = Proc.new {|record| record}
      )
        @api = api
        @args = args
        @context_api = context_api
        @context_builder = context_builder
        @context_filters = context_filters
      end

      protected
      def merge_filters(filters = {}, context_api_name = @context_api.name)
        Hash(filters)
          .merge(Hash(Hash(@context_filters)[context_api_name]))
          .merge(Hash(Hash(@args)[context_api_name]))
        Verse.logger.debug {{merge_filters:{
          filters:, context_api_name:,
          context_filters: @context_filters, args: @args,
          output:
        }}}
      end

      def merge_context_filters(filters = {}, context_api_name = @context_api.name)
        Hash(@context_filters).merge([[context_api_name, merge_filters(filters, context_api_name)]].to_h)
      end
    end
  end
end
