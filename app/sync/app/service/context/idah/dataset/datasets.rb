module Context
  module Idah
    module Dataset
      class Datasets < Base
        def builder(datasets)
          super(datasets)&.map do |dataset|
            id = dataset.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Dataset missing id"
            end

            project_id = dataset.dig(:attributes, :project_id)
            unless project_id
              raise Context::Error::InvalidData, "Dataset missing project_id in attributes"
            end

            filters = build_context_filters_from({
              projects: { id: project_id },
              datasets: { id: },
              entries: { dataset_id: id }
            })

            Unit.new(
              dataset, [
                Entries.new(args, filters, opts),
                Projects.new(args, filters, opts)
              ], args, filters, opts
            )
          end
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
          args = entries.build_context_filters_from(args),
          filters = entries.build_context_filters_from(filters),
          opts = entries.build_opts(opts),
          new(
            args, filters, opts,
            ProceduralCrud.new(:datasets, proc do |filter = nil|
              dataset_ids = entries.index.map { |e| e.record.dig(:attributes, :dataset_id) }.compact.uniq
              dataset_ids.each_slice(batch_size).flat_map do |id__in|
                Datasets.new(args, { datasets: { id__in: } }, opts).index(filter)
              end
            end, args, filters, opts)
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, opts = nil)
          args = projects.build_context_filters_from(args),
          filters = projects.build_context_filters_from(filters),
          opts = projects.build_opts(opts),
          new(
            args, filters, opts,
            ProceduralCrud.new(:datasets, proc do |filter = nil|
              projects.flat_map { |p| p.datasets.index(filter) }
            end)
          )
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          datasets = Datasets.new(args, context, opts)

          super([
            datasets
          ], args, context, opts)
        end
      end
    end
  end
end
