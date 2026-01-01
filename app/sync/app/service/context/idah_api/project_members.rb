module Context
  module IdahApi
    class ProjectMembers < Crud
      def builder(project_member)
        member_id = project_member[:id]
        unless member_id
          raise Context::Error::InvalidData, "ProjectMember missing id"
        end

        project_id = project_member.dig(:attributes, :project_id)
        unless project_id
          raise Context::Error::InvalidData, "ProjectMember missing project_id in attributes"
        end

        Record.new(
          project_member, [
            ProjectMembers.new(args, build_context_filters(id: member_id), opts),
            Projects.new(args, build_context_filters({ id: project_id }, :projects), opts),
            Datasets.new(args, build_context_filters({ project_id: project_id }, :datasets), opts),
            Entries.new(args, build_context_filters({ project_id: project_id }, :entries), opts),
            Annotations.new(args, build_context_filters({ project_id: project_id }, :annotations), opts)
          ]
        )
      end

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        context_api = nil,
        &context_builder
      )
        # Dependency injection: allow passing context_api for testing
        context_api ||= Api[:idah].dataset.project_members

        super(
          context_api,
          args,
          context_filters,
          opts,
          &context_builder
        )
      end

      def self.from_projects(projects, args = {}, filters = {}, opts = {})
        new(
          projects.build_context_filters_from(args),
          projects.build_context_filters_from(filters),
          opts,
          Delegate.new(:project_members, proc do |filter = {}|
            projects.index.flat_map { |p| p.project_members.index(filter) }
          end, args, filters, opts)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        Verse::logger.debug {{idah_apis: self, args:, context:, opts:}}
        project_members = ProjectMembers.new(args, context, opts)
        projects = Projects.from_project_members(project_members, args, context, opts)
        organizations = Organizations.from_projects(projects, args, context, opts)
        datasets = Datasets.from_projects(projects, args, context, opts)
        entries = Entries.from_datasets(datasets, args, context, opts)
        annotations = Annotations.from_entries(entries, args, context, opts)

        # Returns APIs ordered from top-level to leaf-level
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
