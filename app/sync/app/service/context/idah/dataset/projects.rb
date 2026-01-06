module Context
  module Idah
    module Dataset
      class Projects < Base
        def builder(projects)
          super(projects)&.map do |project|
            id = project.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Project missing id"
            end

            org_id = project.dig(:attributes, :organization_id)
            unless org_id
              raise Context::Error::InvalidData, "Project missing organization_id in attributes"
            end

            filters = build_context_filters_from({
              projects: {id:},
              project_members: { project_id: id },
              datasets: { project_id: id },
              organizations: { id: org_id }
            })

            Unit.new(
              project, [
                ProjectMembers.new(args, filters, opts),
                Datasets.new(args, filters, opts),
                Idah::Iam::Organizations.new(args, filters, opts)
              ], args, filters, opts
            )
          end
        end

        def initialize(
          args = nil,
          context_filters = nil,
          opts = nil,
          context_api = nil,
          &context_builder
        )
          super(
            context_api || Api[:idah].dataset.projects,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_organizations(organizations, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE
          args = organizations.build_context_filters_from(args),
          filters = organizations.build_context_filters_from(filters),
          opts = organizations.build(opts),
          new(
            args, filters, opts,
            ProceduralCrud.new(:projects, proc do |filter = nil|
              organization_ids = organizations.index.map { |o| o.record[:id] }.compact.uniq
              organization_ids.each_slice(batch_size).flat_map do |organization_id__in|
                Projects.new(args, build_context_filters_from({ projects: { organization_id__in: } }), opts).index(filter)
              end
            end, args, filters, opts)
          )
        end

        def self.from_project_members(project_members, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          args = project_members.build_context_filters_from(args)
          filters = project_members.build_context_filters_from(filters)
          opts = project_members.build_opts(opts)
          new(
            args, filters, opts,
            ProceduralCrud.new(:projects, proc do |filter = nil|
                project_ids = project_members.index.map { |pm| pm.record.dig(:attributes, :project_id) }.compact.uniq
                project_ids.each_slice(batch_size).flat_map do |id__in|
                  Projects.new(args, build_context_filters_from({ projects: { id__in: } }), opts).index(filter)
                end
              end, args, filters, opts)
            )
        end

        def self.from_datasets(datasets, args = nil, filters = nil, opts = nil)
          batch_size = opts[:batch_size] || DEFAULT_BATCH_SIZE

          args = datasets.build_context_filters_from(args)
          filters = datasets.build_context_filters_from(filters)
          opts = datasets.build_opts(opts)
          new(
            opts,
            ProceduralCrud.new(:projects, proc do |filter = nil|
              project_ids = datasets.index.map { |d| d.record.dig(:attributes, :project_id) }.compact.uniq
              project_ids.each_slice(batch_size).flat_map do |id__in|
                Projects.new(args, { projects: { id__in: } }, opts).index(filter)
              end
            end, args, filters, opts)
          )
        end


        def self.root_api(args = nil, context = nil, opts = nil)
          projects = Projects.new(args, context, opts)
          datasets = Datasets.from_projects(projects, args, context, opts)
          super([datasets], args, context, opts)
        end
      end
    end
  end
end