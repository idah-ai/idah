module Context
  Root = Data.define(:contexts) do
    def initialize(contexts: [])
      Array(contexts).all? do |c|
        raise "Invalid Context missing name for #{c}" if !c.respond_to?(:name)
      end
      Array(contexts).all? do |c|
        raise "Invalid Context name #{c.name}" if !c.name.is_a? String
      end
      super
    end

    def method_missing(name, *args)
      context = contexts.find { |c| c.name.to_sym == name }
      if context
        context
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      contexts.any? { |c| c.name.to_sym == name } || super
    end
  end

  def self.new(contexts = [])
    Root.new(contexts)
  end
end
