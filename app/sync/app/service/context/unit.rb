module Context
  class Unit < Crud
    def initialize(unit, context = nil)
      if context.respond_to? :each
        context
      else
        Array(context)
      end.each do |c|
        instance_variable_set("@#{c.name}", c)
        self.class.send(:attr_reader, c.name)
      end

      @unit = unit
      @context = context || []
      super(self)
    end

    def index
      [@unit]
    end

    def show
      @unit
    end

    def method_missing(name, *args, &block)
      if unit_respond_to_missing(name)
        Verse::logger::debug{:unit_respond_to_missing}
        @unit.send(name, *args, &block)
      elsif context_respond_to_missing(name)
        Verse::logger::debug{:context_respond_to_missing}
        @context.send(name, *args, &block)
      else
        super
      end
    end

    def unit_respond_to_missing(name, include_private = false)
      Verse::logger.debug{{unit_respond_to_missing: name}}
      !@context.map(&:name).include?(name) &&
        @unit.respond_to?(name, include_private) || super
    end

    def context_respond_to_missing(name, include_private = false)
      Verse::logger.debug{{context_respond_to_missing: name}}
      @context.respond_to?(name, include_private) || super
    end

    def respond_to_missing?(name, include_private = false)
      unit_respond_to_missing(name, include_private) ||
        context_respond_to_missing(name, include_private) ||
        super
    end
  end
end