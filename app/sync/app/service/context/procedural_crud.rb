module Context
  class ProceduralCrud < DelegatedProc

    def initialize(name, delegated_proc, args = nil, context_args = nil, opts = nil)
      super
    end
    def index(filters = nil, opts = nil)
      page = build_opts(opts:).dig(:opts, :page, :number)
      call(filters, opts) if page == 1# only one pass
    end

    def show(id = nil)
      result = index({id:})&.first
      unless result
        raise Context::Error::NotFound, [
          name, :id, merge_filters(:id)[:id]
        ].join(" ")
      end

      result
    end
  end
end