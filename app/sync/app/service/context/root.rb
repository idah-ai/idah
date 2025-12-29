module Context
  class Root < Base
    def initialize(contexts = [])
      @contexts = Array(contexts)
      @contexts.each do |c|
        raise "Invalid Context missing name for #{c}" unless c.respond_to?(:name)
        raise "Invalid Context name #{c.name}" unless c.name.is_a?(String) || c.name.is_a?(Symbol)
      end

      Verse::logger.debug {{self: self, contexts:}}

      super(self)
    end

    def method_missing(name, *args)
      @contexts.find { |c| c.name.to_sym == name } || super
    end

    def respond_to_missing?(name, include_private = false)
      @contexts.any? { |c| c.name.to_sym == name } || super
    end
  end
end
