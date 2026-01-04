module Context
  module ApiIdah
    module Dataset
      class Datasets < Base
        def builder(dataset)
          dataset_id = dataset[:id]
          unless dataset_id
            raise Context::Error::InvalidData, "Dataset missing id"
          end

          project_id = dataset.dig(:attributes, :project_id)
          unless project_id
            raise Context::Error::InvalidData, "Dataset missing project_id in attributes"
          end

          Unit.new(
            super(dataset), [
              Datasets.new(args, build_context_filters(id: dataset_id), opts),
              Entries.new(args, build_context_filters({ dataset_id: dataset_id }, :entries), opts),
              Projects.new(args, build_context_filters({ id: project_id }, :projects), opts)
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
            api_context || Api[:idah].dataset.datasets,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_entries(entries, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          new(
            entries.build_context_filters_from(args),
            entries.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:datasets, proc do |filter = nil|
              dataset_ids = entries.index.map { |e| e.record.dig(:attributes, :dataset_id) }.compact.uniq
              dataset_ids.each_slice(batch_size).flat_map do |id__in|
                Datasets.new(args, { datasets: { id__in: } }, opts).index(filter)
              end
            end, args, filters, opts)
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, opts = nil)
          new(
            projects.build_context_filters_from(args),
            projects.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:datasets, proc do |filter = nil|
              projects.flat_map { |p| p.datasets.index(filter) }
            end)
          )
        end

        def self.idah_apis(args = nil, context = nil, opts = nil)
          Verse::logger.debug {{idah_apis: self, args:, context:, opts:}}
          datasets = Datasets.new(args, context, opts)
          projects = Projects.from_datasets(datasets, args, context, opts)
          organizations = Organizations.from_projects(projects, args, context, opts)
          project_members = ProjectMembers.from_projects(projects, args, context, opts)
          entries = Entries.from_datasets(datasets, args, context, opts)
          annotations = Annotations.from_entries(entries, args, context, opts)

          super([
            organizations, projects, project_members, datasets, entries, annotations
          ], args, context, opts)
        end
      end
    end
  end
end
