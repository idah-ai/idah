module Context
  class Delegate < Base
    def name
      @name || super
    end

    def initialize(delegate, _name = nil, args = {}, context_filters = {}, opts = {})
      @name = delegate.respond_to?(:name) ? delegate.name : _name
      @delegate = delegate

      super(self, args, context_filters, opts)
    end

    def method_missing(name, *args, &block)
      @delegate.send(name, *args, &block) || super
    end

    def respond_to_missing?(name, include_private = false)
      @delegate.respond_to?(name, *args, &block) || super
    end
  end
end
