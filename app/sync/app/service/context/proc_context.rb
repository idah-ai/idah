module Context
  class ProcContext < Delegate
    def initialize(name, context_proc, args = nil, context_filters = nil, opts = nil)
      raise Context::Error::InvalidContext, context_proc unless context_proc.respond_to? :call

      super(context_proc, name, args, context_filters, opts)
    end
  end
end
