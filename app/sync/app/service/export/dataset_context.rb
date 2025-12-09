module Export
  class DatasetContext
    attr_reader :dataset, :entries

    def initialize(dataset, entries)
      @dataset = dataset
      @entries = entries
    end

    def self.from_dataset(dataset)
      dataset_id =  dataset[:id] #

      DatasetContext.new(
        dataset,
        Verse::Util::Iterator.chunk_iterator(1) do |entry_page|
          entries_response = Api[:idah].dataset.entries.index(
            filters: {dataset_id:},
            page: {number: entry_page, size: 100}, query_count: false)
          raise entries_response.errors if entries_response.errors

          entries_response.data if !entries_response.data.empty?
        end.lazy.map(&:data).map do |entry|
          EntryContext.from_entry entry
        end
      )
    end
  end
end