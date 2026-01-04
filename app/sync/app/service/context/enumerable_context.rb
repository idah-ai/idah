module Context
  class EnumerableContext < Base
    include Enumerable
    def each(&block)
      return @enumerable.each unless block_given?

      Verse::logger.debug {{self: self.instance_variables}} unless @enumerable
      @enumerable.each(&block)
    end

    def initialize(
      context_api = nil,
      args = nil,
      context_filters = nil,
      opts = nil,
      &context_builder
    )
      raise Context::Error::InvalidContext, self if !context_api.respond_to?(:each)
      context_api.each do |c|
        raise Context::Error::InvalidContext, c unless c.is_a?(Base)

        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end
      @enumerable = context_api
      super(self, args, context_filters, opts, &context_builder)
    end

    # def method_missing(s, *args)
    #   Verse::logger.debug{{s:, context_api: @context_api}}
    #   @context_api&.find { |c| c.name == s } || super
    # end

    # def respond_to_missing?(s, include_private = false)
    #   Verse::logger.debug{{s:, context_api: @context_api}}
    #   Verse::logger.debug{ caller.join("\n") }
    #   @context_api&.any? { |c| c.name == s } || super
    # end
  end
end
