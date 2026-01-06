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
      @args = args
      @context_filters = context_filters
      @opts = opts
      @context_builder = context_builder
    end

    def self.build_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      # passed_filters is already scoped - use directly
      filters_hash = Hash(passed_filters)

      # These still need context scoping
      passed_context_filters = Hash(passed_context_filters)
      passed_args = Hash(passed_args)
      context_filters_hash = Hash(passed_context_filters.dig(context_api_name))
      args_hash = Hash(passed_args.dig(context_api_name))

      # Merge with proper precedence: filters < context_filters < args
      h = filters_hash.merge(context_filters_hash).merge(args_hash)
      h if h && !h.empty?
    end

    def build_filters(
      passed_filters = nil,
      context_api_name = nil,
      passed_context_filters = nil,
      passed_args = nil
    )
      context_api_name ||= @context_api.name if @context_api.respond_to?(:name)

      combined_context_filters = merge_with_instance_var(
        context_api_name, @context_filters, passed_context_filters
      )
      combined_args = merge_with_instance_var(
        context_api_name, @args, passed_args
      )

      self.class.build_filters(
        passed_filters,
        context_api_name,
        combined_context_filters,
        combined_args
      )
    end

    def self.build_context_filters_from(
      passed_context_filters = nil,
      passed_args = nil
    )
      all_api_names = (
        Hash(passed_args).keys +
        Hash(passed_context_filters).keys
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

    def build_context_filters_from(
      passed_context_filters = nil,
      passed_args = nil
    )
      # Combine all API names from all sources
      all_api_names = (
        Hash(passed_context_filters).keys +
        Hash(@context_filters).keys +
        Hash(passed_args).keys +
        Hash(@args).keys
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

    def self.build_opts(
      opts = nil,
      context_api_name = nil,
      passed_opts = nil
    )
      # opts is already scoped - use directly
      opts_hash = Hash(opts)

      # passed_opts needs context scoping
      passed_opts = Hash(passed_opts)
      context_opts_hash = Hash(passed_opts.dig(context_api_name))

      # Merge with proper precedence: opts < context_opts
      h = opts_hash.merge(context_opts_hash)
      h if h && !h.empty?
    end

    def build_opts(
      opts = nil,
      context_api_name = nil,
      passed_opts = nil
    )
      context_api_name ||= @context_api.name if @context_api.respond_to?(:name)

      combined_opts = merge_with_instance_var(
        context_api_name, @opts, passed_opts
      )

      self.class.build_opts(
        opts,
        context_api_name,
        combined_opts
      )
    end

    private

    # Merges instance variable hash with passed hash for a specific API context
    # Instance var values take precedence over passed values
    def merge_with_instance_var(api_name, instance_var, passed_hash)
      return nil unless api_name

      h = Hash(passed_hash&.dig(api_name))
      h = h.merge(instance_var[api_name]) if instance_var&.dig(api_name)
      { api_name => h } unless h.empty?
    end
  end
end
