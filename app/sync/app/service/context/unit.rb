module Context
  class Unit < Crud
    def name
      if @unit.respond_to?(:name)
        @unit.name
      else
        super
      end
    end
    def initialize(unit, context = nil)
      context = Context.new(context)
      if context.respond_to? :each
        context
      else
        Array(context)
      end.each do |c|
        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end

      @unit = unit
      super(self)
    end

    def index(filters = nil, opts = nil)
      [@unit]
    end

    # shoudlnt be required as inferred from index ?...
    def show(id = nil)
      @unit
    end

    def method_missing(name, *args, &block)
      Verse::logger::debug{[[@unit.class, :unit, :method_missing, name].join("#"),]}
      if @unit.respond_to?(name)
        Verse::logger::debug{:on_unit}
        @unit.send(name, *args, &block)
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      @unit.respond_to?(name, include_private) || super
    end
  end
end