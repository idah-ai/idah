class Api
  class Exposition
    attr_reader :parent, :name

    def initialize(parent, name)
      @parent = parent
      @name = name
      @expositions = {}
    end

    def register(method_name, &block)
      define_singleton_method(method_name, &block)
    end
  end
end
