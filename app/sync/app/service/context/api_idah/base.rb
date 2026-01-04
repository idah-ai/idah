module Context
  module ApiIdah
    class Base < CrudIterator
      def name
        @api&.name || super
      end

      def self.builder(unit)
        if @api
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
        if api.class == Api::Exposition
          @api = api
          super(self, args, context_filters, opts)
        else
          super(api, args, context_filters, opts)
        end
      end

      def index(filters = nil, **opts)
        if @api
          query_result = @api.index(**opts.merge(filter: build_filters(filters)))

          raise Error::QueryFailed, query_result.errors if query_result.errors

          query_result.data unless query_result.data.empty?
          query_result.data.lazy.map(&:data).map {|data| builder(data)}
        else
          @context_api.index(filters, opts)
        end
      end

      def method_missing(s, *args, &block)
        @api.send(s, *args, &block) || super
      end

      def respond_to_missing?(s, include_private = false)
        @api.respond_to?(s, include_private) || super
      end

      def self.idah_apis(apis = [], args = {}, context = {}, opts = {})
        Verse::logger.debug {{idah_apis: apis, args:, context:, opts:}}
        apis.each do |api|
          Verse::logger.debug {{api_check: api.class}}
          unless api.class < Base
            raise Context::Error::InvalidContext, api.class
          end
        end
      end
    end
  end
end