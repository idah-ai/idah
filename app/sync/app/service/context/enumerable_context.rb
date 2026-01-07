module Context
  class EnumerableContext < Base
    include Enumerable
    def initialize(
      context_api = nil,
      args = nil,
      context_filters = nil,
      opts = nil,
      &context_builder
    )
      raise Context::Error::InvalidContext, self if !context_api.respond_to?(:each)

      context_api.each do |c|
        unless c.respond_to?(:name) || c.is_a?(EnumerableContext)
          raise Context::Error::InvalidContext, [self, c.class].join("#")
        end
      end
      super(context_api, args, context_filters, opts, &context_builder)
    end

    def method_missing(s, *args, &block)
      __getobj__.find {|c| c.name == s} || super
    end

    def respond_to_missing?(s, include_private = false)
      __getobj__.any?{ |c| c.name == s } || super
    end
  end
end
