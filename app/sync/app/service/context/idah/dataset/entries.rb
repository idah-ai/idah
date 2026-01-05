module Context
  module Idah
    module Dataset
      class Entries < Base
        def builder(entry)
          entry_id = entry[:id]
          unless entry_id
            raise Context::Error::InvalidData, "Entry missing id"
          end

          dataset_id = entry.dig(:attributes, :dataset_id)
          unless dataset_id
            raise Context::Error::InvalidData, "Entry missing dataset_id in attributes"
          end

          resource = entry.dig(:attributes, :resource)
          unless resource
            raise Context::Error::InvalidData, "Entry missing resource in attributes"
          end

          Unit.new(
            super(entry), [
              Entries.new(args, build_context_filters(id: entry_id), opts),
              Datasets.new(args, build_context_filters({ id: dataset_id }, :datasets), opts),
              Idah::Media::Medias.new(args, build_context_filters({ resource: resource }, :medias), opts),
              Annotations.new(args, build_context_filters({ entry_id: entry_id }, :annotations), opts)
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
          new(
            datasets.build_context_filters_from(args),
            datasets.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:entries, proc do |filter = nil, opts = nil|
              datasets.index.flat_map { |d| d.entries.index(filter, opts) }
            end, args, filters, opts)
          )
        end

        def self.from_annotations(annotations, args = nil, filters = nil, opts = annotations.opts)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          new(
            annotations.build_context_filters_from(args),
            annotations.build_context_filters_from(filters),
            opts,
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
          projects = Projects.from_datasets(datasets, args, context, opts)
          organizations = Organizations.from_projects(projects, args, context, opts)
          project_members = ProjectMembers.from_projects(projects, args, context, opts)
          annotations = Annotations.from_entries(entries, args, context, opts)

          super([
            # organizations, projects, project_members, datasets, entries, annotations
            datasets
          ], args, context, opts)
        end
      end
    end
  end
end
