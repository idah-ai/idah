module Context
  module ContextApi
    Context = Data.define(:datasets, :entries, :annotations)
    DelegatedApi = Data.define(:name, :_index) do
      def index(filter = {})
        _index.call(filter)
      end

      def show(id = nil)
        record = _index.call(id:)&.first
        raise Verse::Error::NotFound unless record
        record
      end
    end
    API = Data.define(:name, :api)
    from_datasets_api = API.new(:datasets, proc do |args, api|
      datasets = ContextApi::Datasets.new(api, args)
      entries = ContextApi::Entries.new(
        api, args, {},
        { delegated: DelegatedApi.new(:entries, proc do |filter = {}|
          datasets.index.flat_map { |d| d.entries.index(filter) }
        end) }
      )
      annotations = ContextApi::Annotations.new(
        api, args, {},
        { delegated: DelegatedApi.new(:annotations, proc do |filter = {}|
          entries.index.flat_map { |e| e.annotations.index(filter) }
        end) }
      )
      [datasets, entries, annotations]
    end)

    from_entries_api = API.new(:entries, proc do |args, api|
      entries = ContextApi::Entries.new(api, args)

      # Batched delegated for datasets
      datasets = ContextApi::Datasets.new(
        api, args, {},
        { delegated: DelegatedApi.new(:datasets, proc do |filter = {}|
          dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
          dataset_ids.each_slice(100).flat_map do |id__in|
            ContextApi::Datasets.new(api, args, {datasets:{id__in:}}).index(filter)
          end
        end) }
      )

      annotations = ContextApi::Annotations.new(
        api, args, {},
        { delegated: DelegatedApi.new(:annotations, proc do |filter = {}|
          entries.index.flat_map { |e| e.annotations.index(filter) }
        end) }
      )
      [datasets, entries, annotations]
    end)

    from_annotations_api = API.new(:annotations, proc do |args, api|
      annotations = ContextApi::Annotations.new(api, args)

      # Batched delegated for entries
      entries = ContextApi::Entries.new(
        api, args, {},
        { delegated: DelegatedApi.new(:entries, proc do |filter = {}|
          entry_ids = annotations.index.map { |a| a.record[:attributes][:entry_id] }.compact.uniq
          entry_ids.each_slice(100).flat_map do |id__in|
            ContextApi::Entries.new(api, args, {entries:{id__in:}}).index(filter)
          end
        end) }
      )

      # Batched delegated for datasets via entries
      datasets = ContextApi::Datasets.new(
        api, args, {},
        { delegated: DelegatedApi.new(:datasets, proc do |filter = {}|
          dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
          dataset_ids.each_slice(100).flat_map do |id__in|
            ContextApi::Datasets.new(api, args, {datasets:{id__in:}}).index(filter)
          end
        end) }
      )
      [datasets, entries, annotations]
    end)
    APIS_FROM = [ # should be ordered according to need
      from_datasets_api,
      from_entries_api,
      from_annotations_api
    ]

    def self.api(args = {}, api = :idah)
      args = Hash(args)
      filters = args.keys
      Context.new(*APIS_FROM.filter{ |api_from|
        filters.include?(api_from.name)
      }.first&.api&.call(args, api) || [
        ContextApi::Datasets.new(api, args),
        ContextApi::Entries.new(api, args),
        ContextApi::Annotations.new(api, args)
      ])
    end
  end
end