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
        "#{self.class.to_s}(#{@context_api.class.to_s})"
      end
    end

    def method_missing(s, *args, &block)
      Verse::logger.debug{[self.to_s, s].join("#")}
      @context_api.send(s, *args, &block)
    end

    def respond_to_missing?(s, include_private = false)
      Verse::logger.debug{[self.to_s, :respond_to, s].join("#")}
      if @context_api == self
        false
      else
        @context_api.respond_to?(s, include_private)
      end
    end

    def self.build_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      passed_filters = Hash(passed_filters || {})
      passed_context_filters = Hash(passed_context_filters || {})
      passed_args = Hash(passed_args || {})

      filters_hash = passed_filters.fetch(context_api_name, {})
      context_filters_hash = passed_context_filters.fetch(context_api_name, {})
      args_hash = passed_args.fetch(context_api_name, {})

      filters_hash.merge(context_filters_hash).merge(args_hash)
    end

    def build_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      context_api_name ||= @context_api.name if @context_api.respond_to? :name

      # Pre-merge instance vars with params at the API-specific level
      # Instance vars have higher precedence
      api = context_api_name

      combined_context_filters = {
        api => Hash(passed_context_filters&.dig(api)).merge(@context_filters.fetch(api, {}))
      }

      combined_args = {
        api => Hash(passed_args&.dig(api)).merge(@args.fetch(api, {}))
      }

      # Now delegate to class method with pre-merged values
      self.class.build_filters(
        passed_filters,
        api,
        combined_context_filters,
        combined_args
      )
    end
    def self.build_context_filters_from(
      passed_context_filters = nil,
      passed_args = nil
    )
      all_api_names = (Hash(passed_args).keys + Hash(passed_context_filters).keys).uniq

      all_api_names.each_with_object({}) do |api_name, result|
        result[api_name] = build_filters(
          nil,
          api_name,
          passed_context_filters,
          passed_args
        )
      end
    end

    def build_context_filters_from(
      passed_context_filters = nil,
      passed_args = nil
    )
      # Combine all API names from all sources
      all_api_names = (
        Hash(passed_context_filters).keys +
        @context_filters.keys +
        Hash(passed_args).keys +
        @args.keys
      ).uniq

      all_api_names.each_with_object({}) do |api_name, result|
        result[api_name] = build_filters(
          nil,
          api_name,
          passed_context_filters,
          passed_args
        )
      end
    end

    # Build complete opts from additional opts overrides
    # Processes ALL API names from both @opts and the parameter
    # Ensures no context information is lost during transformation
    def self.build_opts(opts = nil)
      opts
      # raise NotImplementedError
    end
    def build_opts(opts = nil)
      self.class.build_opts(opts)
    end
  end
end
