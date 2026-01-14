module Context
  class DelegatedProc < Delegated
    def initialize(name, delegated_proc, args = nil, context_args = nil, **opts)
      raise Context::Error::InvalidContext, delegated_proc unless delegated_proc.respond_to? :call

      super(delegated_proc, name, args, context_args, **opts)
    end
  end
end
