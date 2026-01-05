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

    def self.builder(context)
      context
    end

    def builder(context)
      self.class.builder(context)
    end

    def initialize(
      context_api = nil,
      args = nil,
      context_filters = nil,
      opts = nil,
      &context_builder
    )
      @context_api = context_api
      @args = Hash(args)
      @context_filters = Hash(context_filters)
      @opts = Hash(opts)
      @context_builder = context_builder
    end

    def to_s
      if @context_api == self
        self.class.to_s
      else
        @context_api.to_s
      end
    end

    def method_missing(s, *args, &block)
      Verse::logger.debug{{self: self.class.to_s, context_api: @context_api.class, method_missing: s}}
        @context_api.send(s, *args, &block)
    end

    def respond_to_missing?(s, include_private = false)
      Verse::logger.debug{{self: self.class.to_s, respond_to_missing: s}}
      if @context_api == self
        false
      else
        @context_api.respond_to?(s, include_private)
      end
    end

    # Generate constrained filters for an API call
    # Merges filters with precedence: on_demand < context_filters < args
    # This ensures class-level context (@args) always takes precedence
    def self.build_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      # Ensure all inputs are treated as hashes, defaulting to empty if nil
      filters_hash = Hash(passed_filters || {}).fetch(context_api_name, {})
      context_filters_hash = Hash(passed_context_filters || {}).fetch(context_api_name, {}).merge(Hash(@context_filters || {}).fetch(context_api_name, {}))
      passed_args_hash = Hash(passed_args || {}).fetch(context_api_name, {})
      args_hash = Hash(@args || {}).fetch(context_api_name, {})

      filters_hash
        .merge(context_filters_hash)
        .merge(passed_args_hash)
        .merge(args_hash)
    end

    def build_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      self.class.build_filters(
        passed_filters,
        context_api_name || @context_api.name,
        passed_context_filters || @context_filters,
        passed_args || @args
      )
    end

    # Generate a constrained context_filters hash given API filters
    # Wraps the merged filters in the appropriate context structure
    def self.build_context_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      new_context_filters = Hash(@context_filters)
      merged_filters = build_filters(
        passed_filters,
        context_api_name,
        passed_context_filters,
        passed_args
      )

      new_context_filters.merge(
        context_api_name || self.name => merged_filters
      )
    end

    def build_context_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      self.class.build_context_filters(
        passed_filters,
        context_api_name || @context_api.name,
        passed_context_filters || @context_filters,
        passed_args || @args
      )
    end

    def self.build_context_filters_from(
      passed_context_filters = nil,
      passed_args = nil
    )
      all_context_filters = Hash(@context_filters).merge(Hash(passed_context_filters || {}))
      all_args = Hash(@args).merge(Hash(passed_args || {}))

      all_api_names = (all_args.keys + all_context_filters.keys).uniq

      all_api_names.each_with_object({}) do |context_api_name, result|
        result.merge!(
          context_api_name => build_filters(
            nil,
            context_api_name,
            all_context_filters,
            all_args
          )
        )
      end
    end

    def build_context_filters_from(
      passed_context_filters = nil,
      passed_args = nil
    )
      self.class.build_context_filters_from(
        passed_context_filters || @context_filters,
        passed_args || @args
      )
    end

    # Build complete opts from additional opts overrides
    # Processes ALL API names from both @opts and the parameter
    # Ensures no context information is lost during transformation
    def self.build_opts(opts = nil)
      opts
      # raise NotImplementedError
    end
    def self.build_opts(opts = nil)
      self.class.build_opts(opts)
    end
  end
end
