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

    def index(**opts)
      built_opts = build_opts(opts.except(:filter))
      built_filters = build_filters(opts.dig(:filter))
      crud_opts = Hash(built_opts).merge(filter: built_filters)
      if __getobj__.class == Api::Exposition
        index_result = __getobj__.index(**crud_opts)
      else
        index_result = super(**crud_opts)
      end
      built_result = builder(index_result)
      result = @context_builder&.call(built_result) || built_result
      result
    end

    def show(id = nil)
      filter = build_filters(id ? { id: } : nil)
      # Validate that an ID is present after filter merging
      unless filter && filter[:id]
        raise Context::Error::NotFound, "No ID available after applying context filters"
      end

      # Security check: if user provided an ID but context changed it
      if id && filter[:id] != id
        raise Context::Error::Forbidden, "Context does not permit access to resource #{id}"
      end

      index(filter:, page: { number: 1, size: 1 }).first
    end

    def update(attributes, id = nil)
      raise NotImplementedError
    end

    def delete(id = nil)
      raise NotImplementedError
    end
  end
end
