module Context
  class Delegate < Base
    attr_reader :name

    def name
      @name
    end

    def initialize(name, delegate, args = {}, context_filters = {}, opts = {})
      @name = name
      @delegate = delegate
      super(self, args, context_filters, opts)
    end

    def index(filter = {})
      @delegate.call(filter)
    end

    def show(id = nil)
      @delegate.call(id:)&.first || (raise Verse::Error::NotFound)
    end
  end
end