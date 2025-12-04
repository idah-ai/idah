module Export
  class RootContext
    attr_reader :name, :datasets

    def initialize(name, datasets)
      @name = name
      @datasets = datasets
    end
  end
end