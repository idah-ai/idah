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

      @enumerable = context_api.each do |c|
        raise Context::Error::InvalidContext, c unless c.respond_to?(:name)

        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end
      super(self, args, context_filters, opts, &context_builder)
    end
  end
end
