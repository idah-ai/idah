module Context
  class ProceduralCrud < ProcContext
    def index(filter = nil, **opts)
      puts(@context_api.class)
      @context_api.call(filter, **opts)
    end

    def show(id = nil)
      Verse::logger{ [self, :show].join("#")}
      result = @context_api.call(merge_filters(id:))

      unless result&.first
        raise Context::Error::NotFound, "Resource with id '#{id}' not found via #{@name} delegate"
      end

      result.first
    end
  end
end