module Context
  module ContextApi
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

            filters = build_context_args_from({
              projects: { id: project_id },
              datasets: { id: },
              entries: { dataset_id: id }
            })

            Unit.new(
              dataset, [
                Entries.new(@args, filters, @opts),
                Projects.new(@args, filters, @opts)
              ], @args, filters, @opts
            )
          end
        end

        def initialize(
          args = nil,
          context_args = nil,
          opts = nil,
          delegated_obj = nil,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].dataset.datasets,
            args,
            context_args,
            opts,
            &context_builder
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, opts = nil)
          built_args = projects.build_context_args_from(args)
          built_context_args = projects.build_context_args_from(filters)
          built_opts = projects.build_opts(opts)

          new(
            built_args, built_context_args, built_opts,
            ProceduralCrud.new(
              :datasets, proc do |filter = nil, opts = nil|
                Enumerator.new do |yielder|
                  projects.each do |project|
                    project.datasets.each do |dataset|
                      yielder << dataset
                    end
                  end
                end
              end,
              built_args, built_context_args, built_opts
            )
          )
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          Datasets.new(args, context, opts)
        end
      end
    end
  end
end
