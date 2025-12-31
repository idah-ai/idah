module Context
  class Delegate < Base
    attr_reader :name

    def initialize(name, delegate, args = {}, context_filters = {}, opts = {})
      @name = name
      @delegate = delegate
      super(self, args, context_filters, opts)
    end

    def index(filter = {})
      @delegate.call(filter)
    end

    def show(id = nil)
      result = @delegate.call(id:)

      unless result&.first
        raise Sync::Error::NotFound, "Resource with id '#{id}' not found via #{@name} delegate"
      end

      result.first
    end
  end
end
