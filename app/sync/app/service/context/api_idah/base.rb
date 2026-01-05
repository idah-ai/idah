module Context
  module ApiIdah
    class Base < CrudIterator
      def self.builder(unit)
        if @context_api.class == Api::Exposition
          Unit.new(unit)
        else
          super
        end
      end

      def initialize(
        api = Api[:idah],
        args = {},
        context_filters = {},
        opts = {},
        &context_builder
      )
        unless [
          Api::Exposition,
          ApiIdah::Base,
          ProceduralCrud,
        ].any? {|whitelist| api.is_a? whitelist}
          raise Error::InvalidContext, self
        end

        super(api, args, context_filters, opts)
      end

      def index(filters = nil, **opts)
        if @context_api.class == Api::Exposition
          query_result = @context_api.index(**opts.merge(filter: build_filters(filters)))

          raise Error::QueryFailed, query_result.errors if query_result.errors

          query_result.data unless query_result.data.empty?
          query_result.data.lazy.map(&:data).map {|data| builder(data)}
        else
          @context_api.index(filters, opts)
        end
      end

      def self.root_api(api, args = {}, context = {}, opts = {})
        Verse::logger.debug {{root_api: api, args:, context:, opts:}}
        unless api.class < Base
          raise Context::Error::InvalidContext, api.class
        end
        api
      end
    end
  end
end