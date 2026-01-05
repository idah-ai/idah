module Context
  class Crud < Base
    include Enumerable
    def each(&block)
      return index.each unless block_given?

      index.each &block
    end

    def create(attributes = nil)
      raise NotImplementedError
    end

    def index(filters = nil, **opts)
      result = @context_api.index(
        build_filters(filters),
        **opts
      )
      result = builder(result)
      @context_builder&.call(result) || result
    end

    def show(id = nil)
      filters = build_filters(id ? { id: } : nil)
      # Validate that an ID is present after filter merging
      unless filters[:id]
        raise Context::Error::NotFound, "No ID available after applying context filters"
      end

      # Security check: if user provided an ID but context changed it
      if id && filters[:id] != id
        raise Context::Error::Forbidden, "Context does not permit access to resource #{id}"
      end

      result = @context_api.index(
        filters:, page: { number: 1, size: 1 }
      ).first
      built_result = builder(result)
      @context_builder&.call(built_result) || built_result
    end

    def update(attributes, id = nil)
      raise NotImplementedError
    end

    def delete(id = nil)
      raise NotImplementedError
    end
  end
end
