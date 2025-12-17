module Context
  module ContextApi
    Context = Data.define(:datasets, :entries, :annotations)
    LoopbackApi = Data.define(:name, :_index) do
      def index(filter = {})
        _index.call(filter)
      end

      def show(id = nil)
        record = _index.call(id:)&.first
        raise Verse::Error::NotFound unless record

        record
      end
    end

    def self.api(args = {}, api = :idah)
      args = Hash(args)
      datasets = args.dig(:datasets)
      entries = args.dig(:entries)
      annotations = args.dig(:annotations)
      filters = [datasets, entries, annotations]
      Verse::logger::debug { [args,{datasets:, entries:, annotations:}]}
      if (datasets&.any? || filters.none?)
        Verse::logger::debug {"FROM datasets"}
        datasets = ContextApi::Datasets.new(api, args)
        entries = ContextApi::Entries.new(
          api, args, {},
          {loopback: LoopbackApi.new(:entries, proc do |filter = {}|
            datasets.index.flat_map {|d| d.entries.index(filter)}
          end)}
        ) do |entry|
            Verse.logger.debug {{entry_from_context_api: entry}}
            Entries::Context.new(
              entry,
              Entries.new(api, args, merge_context_filters(id: entry[:id])),
              Datasets.new(api, args, merge_context_filters({id: entry[:attributes][:dataset_id]}, :datasets)),
              Medias.new(api, args, merge_context_filters({resource: entry[:attributes][:resource]}, :medias)),
              Annotations.new(api, args, merge_context_filters({entry_id: entry[:id]}, :annotations))
            )
        end
        annotations = ContextApi::Annotations.new(
          api, args, {},
          {loopback: LoopbackApi.new(:annotations, proc do |filter = {}|
            # WARN: Might cause duplication ?
            # TODO: aggregate_filters and chunk filters id__in
            entries.index.flat_map {|e| e.annotations.index(filter)}
          end)}
        )
      elsif (entries&.any?)
        Verse::logger::debug {"FROM entries"}
        entries = ContextApi::Entries.new(api, args)
        datasets = ContextApi::Datasets.new(
          api, args, {},
          {loopback: LoopbackApi.new(:datasets, proc do |filter = {}|
            # WARN: Might cause duplication ?
            # TODO: aggregate_filters and chunk filters id__in
            # puts entries.index.map(&:record).to_a
            puts {{self: self, filter:}}
            entries.index.flat_map { |e| e.datasets.index(filter) }
          end)}
        )
        annotations = ContextApi::Annotations.new(
          api, args, {},
          {loopback: LoopbackApi.new(:annotations, proc do |filter = {}|
            entries.index.flat_map { |e| e.annotations.index(filter) }
          end)}
        )
      elsif (annotations&.any)
        Verse::logger::debug {"FROM annotations"}
        annotations = ContextApi::Annotations.new(api, args)
        entries = ContextApi::Entries.new(
          api, args, {},
          {loopback: LoopbackApi.new(:entries, proc do |filter = {}|
            # WARN: Might cause duplication ?
            # TODO: aggregate_filters and chunk filters id__in
            annotations.index.flat_map { |a| a.entries.index(filter) }
          end)}
        )
        datasets = ContextApi::Datasets.new(
          api, args, {},
          {loopback: LoopbackApi.new(:datasets, proc do |filter = {}|
            # WARN: Might cause duplication ?
            # TODO: aggregate_filters and chunk filters id__in
            entries.index.flat_map { |e| e.datasets.index(filter) }
          end)}
        )
      else
        Verse::logger::debug {"FROM default"}
      end
      Context.new(
        datasets || ContextApi::Datasets.new(api, args),
        entries || ContextApi::Entries.new(api, args),
        annotations || ContextApi::Annotations.new(api, args)
      )
    end

    def self.merge_args(args, type, filter)
      args.merge(Hash(args[type]).merge(filter))
    end
  end
end
