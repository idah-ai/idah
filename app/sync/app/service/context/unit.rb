module Context
  class Unit < Crud
    def name
      if @context_api.respond_to?(:name)
        @context_api.name
      else
        super
      end
    end

    def to_s
      @context_api.to_s
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