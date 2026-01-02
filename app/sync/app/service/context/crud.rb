module Context
  DEFAULT_BATCH_SIZE = 100
  class Crud < Base
    def create(attributes = {})
      Verse::logger.debug { [self.class.name, :create].join("#")}
      raise NotImplementedError, "#{self.class.name}#create not implemented"
    end

    def index(filters = {})
      Verse::logger.debug { [self.class.name, :index].join("#")}
      @context_api.index(
        filter: build_filters(filters),
        page: { number:, size: @opts[:page_size] || DEFAULT_BATCH_SIZE }
      )
    end

    def show(id = nil)
      Verse::logger.debug { [self.class.name, :show].join("#")}
      @context_api.show(build_filters(id:).fetch(:id))
    end

    def update(attributes, id = nil)
      Verse::logger.debug { [self.class.name, :update].join("#")}
      raise NotImplementedError, "#{self.class.name}#update not implemented"
    end

    def delete(id = nil)
      Verse::logger.debug { [self.class.name, :delete].join("#")}
      raise NotImplementedError, "#{self.class.name}#delete not implemented"
    end
  end
end
