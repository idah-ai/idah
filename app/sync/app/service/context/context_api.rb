module Context
  module ContextApi
    Context = Data.define(:datasets, :entries, :annotations)
    FeedbackApi = Data.define(:name, :_index) do
      def index(filter = {})
        _index.call(filter)
      end

      def show(id = nil)
        record = index.call(id:)&.first
        raise Verse::Error::NotFound unless record

        record
      end
    end

    def self.api(args = {}, api = :idah)
      args = Hash(args)
      datasets = args.dig(:datasets)
      entries = args.dig(:entries)
      annotations = args.dig(:annotations, :id)
      datasets, entries, annotations = nil, nil, nil
      if (datasets&.any?)
        datasets = ContextApi::Datasets.new(api, args)
        entries = ContextApi::Entries.new(
          FeedbackApi.new(:entries, proc do |filter|
            datasets.index.flat_map {|d| d.entries.index(filter)}
          end),
          {}, {}, {feedback: true}
        )
        annotations = ContextApi::Annotations.new(
          FeedbackApi.new(:annotations, proc do |filter|
            entries.index.flat_map {|e| e.annotations.index(filter)}
          end),
          {}, {}, {feedback: true}
        )
      elsif (entries&.any?)
        entries = ContextApi::Entries.new(api, args)
        datasets = ContextApi::Datasets.new(
          FeedbackApi.new(:datasets, proc do |filter| # might cause duplication and inneffective queries find alternative
            entries.index.flat_map { |e| e.datasets.index(filters) }
          end),
          {}, {}, {feedback: true}
        )
        annotations = ContextApi::Annotations.new(
          FeedbackApi.new(:annotations, proc do |filter|
            entries.index.flat_map { |e| e.annotations.index(filters) }
          end),
          {}, {}, {feedback: true}
        )
      elsif (annotations&.any)
        annotations = ContextApi::Annotations.new(api, args)
        entries = ContextApi::Entries.new(
          FeedbackApi.new(:entries, proc do |filter| # might cause duplication and inneffective queries find alternative
            annotations.index.flat_map { |a| a.entries.index(filters) }
          end),
          {}, {}, {feedback: true}
        )
        datasets = ContextApi::Datasets.new(
          FeedbackApi.new(:datasets, proc do |filter| # might cause duplication and inneffective queries find alternative
            entries.index.flat_map { |e| e.datasets.index(filters) }
          end),
          {}, {}, {feedback: true}
        )
      end
      Context.new(
        datasets || ContextApi::Datasets.new(api, args),
        entries || ContextApi::Entries.new(api, args),
        annotations || ContextApi::Annotations.new(api, args)
      )
    end

    def self.merge_args(args, type, filters)
      args.merge(Hash(args[type]).merge(filters))
    end
  end
end
