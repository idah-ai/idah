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
      raise Context::Error::InvalidContext, delegated_obj unless delegated_obj.kind_of?(Enumerable)
      delegated_obj.each do |c|
        unless c.respond_to?(:name)
          raise Context::Error::InvalidContext, self
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
