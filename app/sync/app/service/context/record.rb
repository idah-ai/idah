module Context
  class Record < Base
    def initialize(record, relations = nil)
      @relations = Root.new(relations)
      super(record)
    end

    def method_missing(name, *args, &block)
      @relations.method_missing(name, *args, &block) || super
    end

    def respond_to_missing?(name, include_private = false)
      @relations.respond_to_missing?(name, include_private) || super
    end
  end
end