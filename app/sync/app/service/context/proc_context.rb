module Context
  class ProcContext < Delegate

    def initialize(name, context_proc, args = nil, context_filters = nil, opts = nil)
      raise Context::Error::InvalidContext, context_proc unless context_proc.respond_to? :call

      @context_proc = context_proc

      super(self, name, args, context_filters, opts)
    end

    def call(filters = nil, opts = nil)
      @context_proc.call(filters, opts)
    end
  end
end
