module Context
  module ContextApi
    Context = Data.define(:datasets, :entries, :annotations)

    DelegatedRelation = Data.define(:name, :_index) do
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
      datasets = args.dig(:datasets),
      entries = args.dig(:entries),
      annotations = args.dig(:annotations)
      filters = [datasets, entries, annotations].compact
      if (datasets&.any? || filters.none?)
        datasets = ContextApi::Datasets.new(api, args)
        entries = ContextApi::Entries.new(
          api, args, {},
          { delegated: DelegatedRelation.new(:entries, proc do |filter = {}|
            datasets.index.flat_map { |d| d.entries.index(filter) }
          end) }
        ) do |entry|
          Entries::Context.new(
            entry,
            Entries.new(api, args, merge_context_filters(id: entry[:id])),
            Datasets.new(api, args, merge_context_filters({ id: entry[:attributes][:dataset_id] }, :datasets)),
            Medias.new(api, args, merge_context_filters({ resource: entry[:attributes][:resource] }, :medias)),
            Annotations.new(api, args, merge_context_filters({ entry_id: entry[:id] }, :annotations))
          )
        end
        annotations = ContextApi::Annotations.new(
          api, args, {},
          { delegated: DelegatedRelation.new(:annotations, proc do |filter = {}|
            entries.index.flat_map { |e| e.annotations.index(filter) }
          end) }
        )
      elsif (entries&.any?)
        entries = ContextApi::Entries.new(api, args)

        # Batched delegated for datasets
        datasets = ContextApi::Datasets.new(
          api, args, {},
          { delegated: DelegatedRelation.new(:datasets, proc do |filter = {}|
            dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
            dataset_ids.each_slice(100).flat_map do |id_chunk|
              ContextApi::Datasets.new(api, args).index(filter.merge(id__in: id_chunk))
            end
          end) }
        )

        annotations = ContextApi::Annotations.new(
          api, args, {},
          { delegated: DelegatedRelation.new(:annotations, proc do |filter = {}|
            entries.index.flat_map { |e| e.annotations.index(filter) }
          end) }
        )
      elsif (annotations&.any?)
        annotations = ContextApi::Annotations.new(api, args)

        # Batched delegated for entries
        entries = ContextApi::Entries.new(
          api, args, {},
          { delegated: DelegatedRelation.new(:entries, proc do |filter = {}|
            entry_ids = annotations.index.map { |a| a.record[:attributes][:entry_id] }.compact.uniq
            entry_ids.each_slice(100).flat_map do |id_chunk|
              ContextApi::Entries.new(api, args).index(filter.merge(id__in: id_chunk))
            end
          end) }
        )

        # Batched delegated for datasets via entries
        datasets = ContextApi::Datasets.new(
          api, args, {},
          { delegated: DelegatedRelation.new(:datasets, proc do |filter = {}|
            dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
            dataset_ids.each_slice(100).flat_map do |id_chunk|
              ContextApi::Datasets.new(api, args).index(filter.merge(id__in: id_chunk))
            end
          end) }
        )
      end

      Context.new(
        datasets || ContextApi::Datasets.new(api, args),
        entries || ContextApi::Entries.new(api, args),
        annotations || ContextApi::Annotations.new(api, args)
      )
    end
  end
end