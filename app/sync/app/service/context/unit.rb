module Context
  class Unit < Crud
    def method_missing(s, *args, &block)
      Verse::logger.debug{[self.to_s, s, args].join("#")}
      if !@context_api.is_a?(Context::Base)
        @context_api.send(s, *args, &block)
      else
        super
      end
    end

    def respond_to_missing?(s, include_private = false)
      Verse::logger.debug{[self.to_s, :respond_to, s].join("#")}
      if @context_api == self
        false
      else
        @context_api.respond_to?(s, include_private)
      end
    end

    def to_s
      "#{super}(#{@context_api.class.to_s})"
    end

    def initialize(unit, context = nil, args = nil, filters = nil, opts = nil)
      context = Context.new(context)
      if context.respond_to? :each
        context
      else
        Array(context)
      end.each do |c|
        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end
      super(unit, args, filters, opts)
    end

    def index(filters = nil, opts = nil)
      [@context_api]
    end

    def show(filters = nil, opts = nil)
      @context_api
    end
  end
end