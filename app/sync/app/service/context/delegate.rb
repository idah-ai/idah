module Context
  class Delegate < Base
    def name
      @name || super
    end

    def initialize(delegate, _name = nil, args = nil, context_filters = nil, opts = nil)
      @name = delegate.respond_to?(:name) ? delegate.name : _name

      super(delegate, args, context_filters, opts)
    end
  end
end
