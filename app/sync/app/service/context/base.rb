module Context
  class Base
    def self.name
      self.to_s.split("::").last
        .gsub(/(?<=[a-z])(?=[A-Z])/, '_')
        .downcase
        .to_sym
    end

    def name
      self.class.name
    end

    def self.builder(record, relations = nil)
      Record.new(record, relations)
    end

    def builder(record)
      self.class.builder(record)
    end

    def initialize(
      context_api = self,
      args = nil,
      context_filters = nil,
      opts = nil,
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
      Verse::logger.debug {[[self.class.name, :method_missing].join("#"), name, args]}
      if @context_api&.respond_to?(name)
        @context_api.send(name, *args, &block)
      end
    end

    def respond_to_missing?(name, include_private = false)
      Verse::logger.debug {[[self.class.name, :respond_to_missing?].join("#"), name, include_private]}
      @context_api&.respond_to?(name, include_private)
    end

    # Generate constrained filters for an API call
    # Merges filters with precedence: on_demand < context_filters < args
    # This ensures class-level context (@args) always takes precedence
    def self.build_filters(filters = nil, context_api_name = nil, context_filters = nil, args = nil)
      Hash(filters) # on_demand api filters
        .merge(Hash(Hash(context_filters)[context_api_name])) # dynamic context filters merge/override
        .merge(Hash(Hash(args)[context_api_name])) # general context filters merge/override (highest precedence)
    end
    def build_filters(filters = nil, context_api_name = nil)
      self.class.build_filters(filters, context_api_name || @context_api.name, @context_filters, @args)
    end

    # Generate a constrained context_filters hash given API filters
    # Wraps the merged filters in the appropriate context structure
    def self.build_context_filters(filters = nil, context_api_name = nil, context_filters = nil)
      Hash(context_filters)
        .merge([[context_api_name || self.name, build_filters(filters, context_api_name || self.name)]].to_h)
    end
    def build_context_filters(filters = nil, context_api_name = nil)
      self.class.build_context_filters(filters, context_api_name || @context_api.name, @context_filters)
    end
    # Build complete context_filters from additional filter overrides
    # Processes ALL API names from both @args and the parameter
    # Ensures no context information is lost during transformation
    def self.build_context_filters_from(context_filters = nil, args = nil)
      Verse::logger.debug{{context_filters:, args:}}
      all_api_names = (Hash(args).keys + Hash(context_filters).keys).uniq

      all_api_names.reduce({}) do |h, context_api_name|
        filters = Hash(context_filters)[context_api_name]
        h.merge(build_context_filters(filters, context_api_name))
      end
    end
    def build_context_filters_from(context_filters = nil)
      self.class.build_context_filters_from(context_filters, @args)
    end
  end
end
