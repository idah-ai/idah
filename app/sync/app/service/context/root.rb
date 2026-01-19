module Context
  class Root < EnumerableContext
    def initialize(
      delegated_obj = nil,
      args = nil,
      context_args = nil,
      **opts,
      &context_builder
    )
      root = Context.new(delegated_obj)
      if root.respond_to?(:io) && !root.io.is_a?(Io)
        raise Context::Error::InvalidContext, "invalid Io on #{root}"
      end
      unless root.respond_to?(:datasets) && root.datasets.is_a?(Crud)
        raise Context::Error::InvalidContext, "invalid context api on #{root}"
      end
      super(root, args, context_args, **opts, &context_builder)
    end
  end
end