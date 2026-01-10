module Context
  class Unit < Crud
    def initialize(unit, context = nil, args = nil, filters = nil, opts = nil)
      context = Context.new(context) if context && !context.respond_to?(:name)

      if context.respond_to?(:each) && !context.is_a?(Crud)
        context
      else
        Array(context)
      end.each do |c|
        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end
      super(unit, args, filters, opts)
    end

    def index(**opts)
      [__getobj__]
    end
  end
end