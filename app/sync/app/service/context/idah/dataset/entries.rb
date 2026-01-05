module Context
  module Idah
    module Dataset
      class Entries < Base
        def builder(entry)
          id = entry.dig(:id)
          unless id
            raise Context::Error::InvalidData, "Entry missing id"
          end

          resource = entry.dig(:attributes, :resource)
          unless resource
            raise Context::Error::InvalidData, "Entry missing resource in attributes"
          end

          filters = build_context_filters_from({
            entries: {id:, resource:},
            medias: {resource:},
            annotations: { entry_id: id }
          })
          Unit.new(
            super(entry), [
              Idah::Media::Medias.new(args, filters, opts),
              Annotations.new(args, filters, opts)
            ]
          )
        end

        def initialize(
          args = nil,
          context_filters = nil,
          opts = nil,
          api_context = nil,
          &context_builder
        )
          super(
            api_context || Api[:idah].dataset.entries,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_datasets(datasets, args = nil, filters = nil, opts = nil)
          args = datasets.build_context_filters_from(args),
          filters = datasets.build_context_filters_from(filters),
          opts = datasets.build_opts(opts),

          new(
            args, filters, opts,
            ProceduralCrud.new(:entries, proc do |filter = nil, opts = nil|
              datasets.index.flat_map { |d| d.entries.index(filter, opts) }
            end, args, filters, opts)
          )
        end

        def self.from_annotations(annotations, args = nil, filters = nil, opts = annotations.opts)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE
          args = annotations.build_context_filters_from(args),
          filters = annotations.build_context_filters_from(filters),
          opts = annotations.build_opts(opts)

          new(
            args, filters, opts,
            ProceduralCrud.new(:entries, proc do |filter = nil, opts = nil|
              entry_ids = annotations.index.map { |a| a.record.dig(:attributes, :entry_id) }.compact.uniq
              entry_ids.each_slice(batch_size).flat_map do |id__in|
                Entries.new(args, { entries: { id__in: } }, opts).index(filter)
              end
            end, args, filters, opts)
          )
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          entries = Entries.new(args, context, opts)
          datasets = Datasets.from_entries(entries, args, context, opts)

          super([
            datasets
          ], args, context, opts)
        end
      end
    end
  end
end
