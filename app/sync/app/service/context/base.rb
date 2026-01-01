module Context
  class Base
    attr_reader :args, :context_filters, :opts
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
      Record.new(record)
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
      @args = Hash(args)
      @context_api = context_api
      @context_builder = context_builder
      @context_filters = Hash(context_filters)
      @opts = Hash(opts)
      Verse::logger.debug { {init: self.name, args: @args, context_filters: @context_filters, opts:@opts} }
    end

    def method_missing(name, *args, &block)
      if @context_api.respond_to?(name)
        @context_api.send(name, *args, &block)
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      @context_api.respond_to?(name) || super
    end

    # Generate constrained filters for an API call
    # Merges filters with precedence: on_demand < context_filters < args
    # This ensures class-level context (@args) always takes precedence
    def build_filters(filters = {}, context_api_name = @context_api.name)
      Hash(filters) # on_demand api filters
        .merge(Hash(Hash(@context_filters)[context_api_name])) # dynamic context filters merge/override
        .merge(Hash(Hash(@args)[context_api_name])) # general context filters merge/override (highest precedence)
    end

    # Generate a constrained context_filters hash given API filters
    # Wraps the merged filters in the appropriate context structure
    def build_context_filters(filters = {}, context_api_name = @context_api.name)
      Hash(@context_filters)
        .merge([[context_api_name, build_filters(filters, context_api_name)]].to_h)
    end

    # Build complete context_filters from additional filter overrides
    # Processes ALL API names from both @args and the parameter
    # Ensures no context information is lost during transformation
    def build_context_filters_from(additional_filters = {})
      all_api_names = (Hash(@args).keys + Hash(additional_filters).keys).uniq

      all_api_names.reduce({}) do |h, context_api_name|
        filters = Hash(additional_filters)[context_api_name]
        h.merge(build_context_filters(filters, context_api_name))
      end
    end
  end
end
