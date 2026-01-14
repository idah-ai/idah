module Context
  class EnumerableContext < Base
    include Enumerable
    def initialize(
      delegated_obj = nil,
      args = nil,
      context_args = nil,
      **opts,
      &context_builder
    )
      raise Context::Error::InvalidContext, self if !delegated_obj.respond_to?(:each)

      delegated_obj.each do |c|
        unless c.respond_to?(:name)
          raise Context::Error::InvalidContext, [self, c.class].join("#")
        end
      end
      super(delegated_obj, args, context_args, **opts, &context_builder)
    end

    def method_missing(s, *args, &block)
      __getobj__.find{ |c| c.name == s } || super
    end

    def respond_to_missing?(s, include_private = false)
      __getobj__.any?{ |c| c.name == s } || super
    end
  end
end
