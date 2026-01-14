module Context
  class Delegated < Crud
    def name
      @name || super
    end

    def initialize(delegate, _name = nil, args = nil, context_args = nil, **opts)
      @name = _name || (delegate.respond_to?(:name) ? delegate.name : nil)

      super(delegate, args, context_args, **opts)
    end
  end
end
