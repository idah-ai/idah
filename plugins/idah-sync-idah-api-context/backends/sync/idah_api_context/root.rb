module IdahApiContext
  class Root
    attr_reader :name, :datasets

    self.dataset_class = DatasetContext

    def initialize(name, datasets)
      @name = name
      @datasets = datasets
    end
  end
end