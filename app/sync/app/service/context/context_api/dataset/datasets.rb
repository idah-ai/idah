module Context
  module ContextApi
    module Dataset
      class Datasets < Base
        def builder(datasets)
          superdatasets = super(datasets)
          return unless superdatasets
          superdatasets.lazy.map do |dataset|
            id = dataset.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Dataset missing id"
            end

            project_id = dataset.dig(:attributes, :project_id)
            unless project_id
              raise Context::Error::InvalidData, "Dataset missing project_id in attributes"
            end

            filters = build_context_args({
              datasets: { id: },
              projects: { id: project_id },
              entries: { dataset_id: id }
            })

            Unit.new(
              dataset,
                [Entries.new(@args, filters, @opts)], @args, filters, **@opts
            )
          end
        end

        def initialize(
          args = nil,
          context_args = nil,
          delegated_obj = nil,
          **opts,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].dataset.datasets,
            args,
            context_args,
            **opts,
            &context_builder
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, **opts)
          built_args = projects.build_context_args(args)
          built_context_args = projects.build_context_args(filters)
          built_opts = projects.build_opts(opts)

          new(
            built_args, built_context_args,
            CrudProcedural.new(
              :datasets, proc do |**opts|
                project_ids = projects.lazy.map do |project|
                  project[:id]
                end.each_slice(DEFAULT_BATCH_SIZE)
                Verse::Util::Iterator.chunk_iterator do |_|
                  begin
                    project_id__in = project_ids.next
                    new(
                      built_args,
                      self.build_context_args(
                        built_context_args,
                        {datasets: { project_id__in: }}
                      ), **built_opts
                    ).index(**opts)
                  rescue StopIteration => _
                    nil
                  end
                end
              end, built_args, built_context_args, **built_opts
            ), **built_opts
          )
        end

        def self.root_api(args = nil, context = nil, **opts)
          Datasets.new(args, context, **opts)
        end
      end
    end
  end
end
