module Context
  Context = Data.define(:contexts) do
    def method_missing(name, *args)
      context = contexts.find { |c| c.name.to_sym == name }
      if context
        context
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      contexts.any? { |c| c.name == name } || super
    end
  end

  def self.new(contexts)
    Context.new(contexts)
  end
end
