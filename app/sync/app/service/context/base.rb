module Context
  def self.new(context = nil)
    if context&.is_a?(Base)
      context
    elsif context&.respond_to?(:each)
      EnumerableContext.new(context)
    else
      Base.new(context)
    end
  end

  class Base < SimpleDelegator
    attr_reader :args, :context_args, :opts
    def self.name
      self.to_s.split("::").last
        .gsub(/(?<=[a-z])(?=[A-Z])/, '_')
        .downcase
        .to_sym
    end

    def name
      if __getobj__.respond_to?(:name)
        __getobj__.name
      else
        self.class.name
      end
    end

    def self.builder(obj)
      obj
    end

    def builder(obj)
      self.class.builder(obj)
    end

    def initialize(
      delegated_obj = nil,
      args = nil,
      context_args = nil,
      opts = nil,
      &context_builder
    )
      @args = args
      @context_args = context_args
      @opts = opts
      @context_builder = context_builder
      super(delegated_obj)
    end

    # Class method: builds filters for a single API
    # Precedence: passed_filters < passed_context_args < passed_args
    def self.build_filters(
      passed_filters = nil,
      delegated_obj_name = nil,
      passed_args = nil,
      passed_context_args = nil
    )
      filters_hash = Hash(passed_filters)
      passed_args = Hash(passed_args)
      passed_context_args = Hash(passed_context_args)

      # Extract data for the specific API
      args_hash = Hash(passed_args.dig(delegated_obj_name) || {})
      context_args_hash = Hash(passed_context_args.dig(delegated_obj_name) || {})

      # Merge with proper precedence: filters < context_args < args
      filters = filters_hash.merge(context_args_hash).merge(args_hash)

      filters.empty? ? nil : filters
    end


    # Instance method: builds filters using instance variables
    # Precedence: passed_filters < passed_context_args < @context_args < passed_args < @args
    def build_filters(
      passed_filters = nil,
      delegated_obj_name = nil,
      passed_context_args = nil,
      passed_args = nil
    )
      # Don't merge passed_args with @args yet - they have different precedence
      # Get each source separately
      instance_args_hash = Hash(@args || {}).dig(delegated_obj_name || name) || {}
      instance_context_args_hash = Hash(@context_args || {}).dig(delegated_obj_name || name) || {}
      passed_args_hash = Hash(passed_args || {}).dig(delegated_obj_name || name) || {}
      passed_context_args_hash = Hash(passed_context_args || {}).dig(delegated_obj_name || name) || {}

      # Apply precedence: passed_filters < passed_context_args < instance_context_args < passed_args < instance_args
      filters = {}
      filters = filters.merge(Hash(passed_filters || {}))
      filters = filters.merge(passed_context_args_hash) { |key, old_val, new_val| new_val }
      filters = filters.merge(instance_context_args_hash) { |key, old_val, new_val| new_val }
      filters = filters.merge(passed_args_hash) { |key, old_val, new_val| new_val }
      filters = filters.merge(instance_args_hash) { |key, old_val, new_val| new_val }

      filters.empty? ? nil : filters
    end

    # Class method: aggregates filters for all APIs
    # Returns: { api1: {filters}, api2: {filters}, ... }
    def self.build_context_args_from(
      passed_args = nil,
      passed_context_args = nil
    )
      all_api_names = (
        Hash(passed_args).keys +
        Hash(passed_context_args).keys
      ).uniq

      args_context = all_api_names.each_with_object({}) do |api_name, result|
        filters = build_filters(
          nil,
          api_name,
          passed_args,
          passed_context_args
        )
        result[api_name] = filters if filters
      end

      args_context.empty? ? nil : args_context
    end

    # Instance method: aggregates filters using instance variables
    # Precedence: passed_context_args < @context_args < @args
    def build_context_args_from(passed_context_args = nil)
      # Collect all API names from all three sources
      all_api_names = (
        Hash(passed_context_args || {}).keys +
        Hash(@context_args || {}).keys +
        Hash(@args || {}).keys
      ).uniq

      # For each API, merge the three sources with correct precedence
      result = all_api_names.each_with_object({}) do |api_name, hash|
        passed = Hash(passed_context_args || {}).dig(api_name) || {}
        context = Hash(@context_args || {}).dig(api_name) || {}
        args = Hash(@args || {}).dig(api_name) || {}

        # Merge with precedence: passed < context < args
        merged = passed.merge(context).merge(args)
        hash[api_name] = merged unless merged.empty?
      end

      result.empty? ? nil : result
    end

    # Class method: builds opts for a single API
    # Precedence: opts < passed_opts
    def self.build_opts(
      delegated_obj_name = nil,
      opts = nil,
      passed_opts = nil
    )
      opts_hash = Hash(opts)
      passed_opts = Hash(passed_opts)

      # Extract data for the specific API
      context_opts_hash = Hash(passed_opts.dig(delegated_obj_name) || {})

      # Merge with proper precedence: opts < context_opts
      opts_context = opts_hash.merge(context_opts_hash)

      opts_context.empty? ? nil : opts_context
    end

    # Instance method: builds opts using instance variable
    # Precedence: opts < passed_opts < @opts
    def build_opts(
      opts = nil,
      delegated_obj_name = nil,
      passed_opts = nil
    )
      # Get each source separately
      instance_opts_hash = Hash(@opts || {}).dig(delegated_obj_name || name) || {}
      passed_opts_hash = Hash(passed_opts || {}).dig(delegated_obj_name || name) || {}
      non_context_opts = Hash(opts || {})

      # Apply precedence: opts < passed_opts < instance_opts
      result = {}
      result = result.merge(non_context_opts)
      result = result.merge(passed_opts_hash) { |key, old_val, new_val| new_val }
      result = result.merge(instance_opts_hash) { |key, old_val, new_val| new_val }

      result.empty? ? nil : result
    end

    # Class method: aggregates opts for all APIs
    # Returns: { api1: {opts}, api2: {opts}, ... }
    def self.build_context_opts(
      opts = nil,
      passed_opts = nil
    )
      all_api_names = (
        Hash(opts).keys +
        Hash(passed_opts).keys
      ).uniq

      opts_context = all_api_names.each_with_object({}) do |api_name, result|
        api_opts = build_opts(
          api_name,
          Hash(opts).dig(api_name),
          passed_opts
        )
        result[api_name] = api_opts if api_opts
      end

      opts_context.empty? ? nil : opts_context
    end

    # Instance method: aggregates opts using instance variable
    # @opts has higher precedence than passed opts
    def build_context_opts(opts = nil)
      self.class.build_context_opts(opts, @opts)
    end
  end
end