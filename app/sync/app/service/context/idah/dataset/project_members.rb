module Context
  module Idah
    module Dataset
      class ProjectMembers < Base
        def builder(project_member)
          id = project_member.dig(:id)
          unless id
            raise Context::Error::InvalidData, "ProjectMember missing id"
          end

          project_id = project_member.dig(:attributes, :project_id)
          unless project_id
            raise Context::Error::InvalidData, "ProjectMember missing project_id in attributes"
          end

          filters = build_context_filters_from({
            project_members: { id: }, projects: {id: project_id}
          })

          Unit.new(
            super(project_member), [
              Projects.new(args, filters, opts),
            ]
          )
        end

        def initialize(
          args = nil,
          context_filters = nil,
          opts = nil,
          context_api = nil,
          &context_builder
        )
          super(
            context_api || Api[:idah].dataset.project_members,
            args,
            context_filters,
            opts,
            &context_builder
          )
        end

        def self.from_projects(projects, args = nil, filters = nil, opts = nil)
          new(
            projects.build_context_filters_from(args),
            projects.build_context_filters_from(filters),
            opts,
            ProceduralCrud.new(:project_members, proc do |filter = nil|
              projects.index.flat_map { |p| p.project_members.index(filter) }
            end, args, filters, opts)
          )
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          project_members = ProjectMembers.new(args, context, opts)
          projects = Projects.from_project_members(project_members, args, context, opts)
          datasets = Datasets.from_projects(projects, args, context, opts)

          super([datasets], args, context, opts)
        end
      end
    end
  end
end
