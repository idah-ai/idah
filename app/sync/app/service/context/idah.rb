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
      entries = Idah::Entries.from_datasets(datasets, args)
      annotations = Idah::Annotations.from_entries(entries, args)
      [datasets, entries, annotations]
    end)

    from_entries_api = API.new(:entries, proc do |args|
      entries = Idah::Entries.new(args)
      datasets = Idah::Datasets.from_entries(entries, args)
      annotations = Idah::Annotations.from_entries(entries, args)
      [datasets, entries, annotations]
    end)

    from_annotations_api = API.new(:annotations, proc do |args|
      annotations = Idah::Annotations.new(args)
      entries = Idah::Entries.from_annotations(annotations, args)
      datasets = Idah::Datasets.from_entries(entries, args)
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