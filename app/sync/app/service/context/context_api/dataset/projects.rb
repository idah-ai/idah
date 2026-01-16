module Context
  module ContextApi
    module Dataset
      class Projects < Base
        def builder(projects)
          super_projects = super(projects)
          return unless super_projects

          super_projects.lazy.map do |project|
            id = project.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Project missing id"
            end

            org_id = project.dig(:attributes, :organization_id)
            unless org_id
              raise Context::Error::InvalidData, "Project missing organization_id in attributes"
            end

            filters = build_context_args({
              projects: {id:},
              project_members: { project_id: id },
              datasets: { project_id: id },
              organizations: { id: org_id }
            })

            Unit.new(
              project, [
                ProjectMembers.new(@args, filters, **@opts),
                Datasets.new(@args, filters, **@opts),
                ContextApi::Iam::Organizations.new(@args, filters, **@opts)
              ], @args, filters, **@opts
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
            delegated_obj || Api[:idah].dataset.projects,
            args,
            context_args,
            **opts,
            &context_builder
          )
        end

        def self.from_organizations(organizations, args = nil, context_args = nil, **opts)
          built_args = organizations.build_context_args(args)
          built_context_args = organizations.build_context_args(context_args)
          built_opts = organizations.build_opts(opts)

          new(
            built_args, built_context_args,
            CrudProcedural.new(
              :projects, proc do |**opts|
                organization_ids = organizations.lazy.map do |organization|
                  organization[:id]
                end.each_slice(DEFAULT_BATCH_SIZE)
                Verse::Util::Iterator.chunk_iterator do |_|
                  begin
                    organization_id__in = organization_ids.next
                    new(
                      built_args,
                      self.build_context_args(
                        built_context_args,
                        {projects: { organization_id__in: }}
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
          projects = Projects.new(args, context, **opts)

          Datasets.from_projects(projects, args, context, **opts)
        end
      end
    end
  end
end