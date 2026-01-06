module Context
  class ProceduralCrud < ProcContext
    def index(filters = nil, opts = nil)
      filters = merge_filters(filters)
      opts = merge_opts(opts)
      @context_api.call(filters, opts)
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