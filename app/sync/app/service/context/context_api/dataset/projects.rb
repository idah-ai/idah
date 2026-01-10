module Context
  module ContextApi
    module Dataset
      class Projects < Base
        def builder(projects)
          super_projects = super(projects)
          super_projects&.map do |project|
            id = project.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Project missing id"
            end

            org_id = project.dig(:attributes, :organization_id)
            unless org_id
              raise Context::Error::InvalidData, "Project missing organization_id in attributes"
            end

            filters = build_context_args_from({
              projects: {id:},
              project_members: { project_id: id },
              datasets: { project_id: id },
              organizations: { id: org_id }
            })

            Unit.new(
              project, [
                ProjectMembers.new(@args, filters, @opts),
                Datasets.new(@args, filters, @opts),
                ContextApi::Iam::Organizations.new(@args, filters, @opts)
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
            delegated_obj || Api[:idah].dataset.projects,
            args,
            context_args,
            opts,
            &context_builder
          )
        end

        def self.from_organizations(organizations, args = nil, context_args = nil, opts = nil)
          built_args = organizations.build_context_args_from(args)
          built_context_args = organizations.build_context_args_from(context_args)
          built_opts = organizations.build_opts(opts)

          ProceduralEnumerableCrud.new(
            :projects, proc do |**opts|
              Enumerator.new do |yielder|
                organizations.each do |organization|
                  organization.projects.index(**opts).each do |project|
                    yielder << project
                  end
                end
              end
            end,
            built_args, built_context_args, built_opts
          )
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          projects = Projects.new(args, context, opts)

          Datasets.from_projects(projects, args, context, opts)
        end
      end
    end
  end
end