module Context
  module Idah
    Context = Data.define(:name, :datasets, :entries, :annotations) do
    end

    Delegated = Data.define(:name, :_index) do
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
    from_datasets_api = API.new(:datasets, proc do |args|
      datasets = Idah::Datasets.new(args)
      entries = Idah::Entries.new(
        args, {},
        { delegated: true },
        Delegated.new(:entries, proc do |filter = {}|
          datasets.index.flat_map { |d| d.entries.index(filter) }
        end)
      )
      annotations = Idah::Annotations.new(
        args, {},
        { delegated: true },
        Delegated.new(:annotations, proc do |filter = {}|
          entries.index.flat_map { |e| e.annotations.index(filter) }
        end)
      )
      [datasets, entries, annotations]
    end)

    from_entries_api = API.new(:entries, proc do |args|
      entries = Idah::Entries.new(args)

      # Batched delegated for datasets
      datasets = Idah::Datasets.new(
        args, {},
        { delegated: true },
        Delegated.new(:datasets, proc do |filter = {}|
          dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
          dataset_ids.each_slice(100).flat_map do |id__in|
            Idah::Datasets.new(args, {datasets:{id__in:}}).index(filter)
          end
        end)
      )

      annotations = Idah::Annotations.new(
        args, {},
        { delegated: true },
        Delegated.new(:annotations, proc do |filter = {}|
          entries.index.flat_map { |e| e.annotations.index(filter) }
        end)
      )
      [datasets, entries, annotations]
    end)

    from_annotations_api = API.new(:annotations, proc do |args|
      annotations = Idah::Annotations.new(args)

      # Batched delegated for entries
      entries = Idah::Entries.new(
        args, {},
        { delegated: true },
        Delegated.new(:entries, proc do |filter = {}|
          entry_ids = annotations.index.map { |a| a.record[:attributes][:entry_id] }.compact.uniq
          entry_ids.each_slice(100).flat_map do |id__in|
            Idah::Entries.new(args, {entries:{id__in:}}).index(filter)
          end
        end)
      )

      # Batched delegated for datasets via entries
      datasets = Idah::Datasets.new(
        api, args, {},
        { delegated: true },
        Delegated.new(:datasets, proc do |filter = {}|
          dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
          dataset_ids.each_slice(100).flat_map do |id__in|
            Idah::Datasets.new(api, args, {datasets:{id__in:}}).index(filter)
          end
        end)
      )
      [datasets, entries, annotations]
    end)
    APIS_FROM = [ # should be ordered according to need
      from_datasets_api,
      from_entries_api,
      from_annotations_api
    ]

    def self.new(args = {})
      args = Hash(args)
      filters = args.keys
      Context.new("idah", *(APIS_FROM.filter{ |api_from|
        filters.include?(api_from.name)
      }.first&.api&.call(args) || [
        Idah::Datasets.new(args),
        Idah::Entries.new(args),
        Idah::Annotations.new(args)
      ]))
    end
  end
end