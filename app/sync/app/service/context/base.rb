module Context
  class Base
    attr_reader :context_filters, :args, :opts
    def self.name
      self.to_s.split("::").last
        .gsub(/(?<=[a-z])(?=[A-Z])/, '_')
        .downcase
        .to_sym
    end

    def name
      self.class.name
    end

    def self.builder(record)
      record
    end

    def builder(record)
      self.class.builder(record)
    end

    def initialize(
      context_api = self,
      args = {},
      context_filters = {},
      opts = {},
      &context_builder
    )
      @args = args
      @context_api = context_api
      @context_builder = context_builder
      @context_filters = context_filters
      @opts = opts
      Verse::logger.debug {[:init_context, self.name, self].join(' ')}
    end

    # generate a context constrained filters hash for an api
    def merge_filters(filters = {}, context_api_name = @context_api.name)
      Hash(filters) # on_demand api filters
        .merge(Hash(Hash(@context_filters)[context_api_name])) # dynamic context filters merge/override
        .merge(Hash(Hash(@args)[context_api_name])) # general context filters merge/Override
    end

    # generate a context constrained context_filters hash given an api filters hash
    def merge_context_filters(filters = {}, context_api_name = @context_api.name)
      Hash(@context_filters)
        .merge([[context_api_name, merge_filters(filters, context_api_name)]].to_h)
    end

    # generate a context constrained context_filters hash given another context_filters hash
    def merge_args(context_filters = {})
      Hash(args).reduce({}) do|h , (context_api_name, filters)|
        h.merge(merge_context_filters(filters, context_api_name))
      end
    end
  end
end
