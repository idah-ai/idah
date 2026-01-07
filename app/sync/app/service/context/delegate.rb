module Context
  class Delegate < Base
    def name
      @name || super
    end

    def initialize(delegate, _name = nil, args = nil, context_filters = nil, opts = nil)
      @name = _name || delegate.respond_to?(:name) ? delegate.name : nil

      super(delegate, args, context_filters, opts)
    end
  end
end
