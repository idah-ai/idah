module IdahApiContext
  class RootContext
    attr_reader :name, :datasets

    def initialize(name, datasets)
      @name = name
      @datasets = datasets
    end

    def self.from(args)
      # todo filters args and refine api accordingly

      new(
        [:export, Time.now.to_i],
        Verse::Util::Iterator.chunk_iterator(1) do |dataset_page|
          dataset_response = Api[:idah].dataset.datasets.index(
            filters: {
              #
            },
            page: {number: dataset_page, size: 100}, query_count: false)
          raise dataset_response.errors if dataset_response.errors

          dataset_response.data if !dataset_response.data.empty?
        end.lazy.map(&:data).map do |dataset|
          DatasetContext.from_dataset dataset
        end
      )
    end
  end
end