module Context
  class EnumerableContext < Base
    include Enumerable
    def each(&block)
      return @context_api.each unless block_given?

      @context_api.each(&block)
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
        unless c.respond_to?(:name)
          Verse::logger::error(caller.join("\n"))
          raise Context::Error::InvalidContext, [self, c.class].join("#")
        end

        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end
      super(context_api, args, context_filters, opts, &context_builder)
    end
  end
end
