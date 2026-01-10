module Context
  class ProceduralCrud < DelegatedProc
    def initialize(name, delegated_proc, args = nil, context_args = nil, opts = nil)
      super
    end

    def index(**opts)
      call(**opts)
    end
  end
end