module Context
  Context = Data.define(:contexts) do
    def initialize(contexts: [])
      raise "Invalid Context missing name" if Array(contexts).any? { |c| !c.respond_to?(:name) }
      raise "Invalid Context name" if Array(contexts).any? { |c| !c.name.is_a? String }
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
    Context.new(contexts: contexts)
  end
end
