module Context
  class Root < Base
    def initialize(contexts = [])
      @contexts = Array(contexts).map do |context|
        unless context.class < Base
          raise Context::Error::InvalidContext, context.class
        end

        context
      end

      super(self)
    end

    def method_missing(name, *args)
      @contexts.find { |c| c.name == name } || super
    end

    def respond_to_missing?(name, include_private = false)
      @contexts.any? { |c| c.name == name } || super
    end
  end
end
