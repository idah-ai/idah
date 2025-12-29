module Context
  class Root < Base
    def initialize(contexts = [])
      @contexts = Array(contexts)
      @contexts.all? do |c|
        raise "Invalid Context missing name for #{c}" if !c.respond_to?(:name)
      end
      @contexts.all? do |c|
        raise "Invalid Context name #{c.name}" if !(c.name.is_a?(String) || c.name.is_a?(Symbol))
      end
    end

    def method_missing(name, *args)
      @contexts.find { |c| c.name.to_sym == name } || super
    end

    def respond_to_missing?(name, include_private = false)
      @contexts.any? { |c| c.name.to_sym == name } || super
    end
  end
end
