module Context
  module IdahApi
    class Organizations < CrudIterator
      def builder(organization)
        org_id = organization[:id]
        unless org_id
          raise Context::Error::InvalidData, "Organization missing id"
        end

        Record.new(
          organization,
          [
            Organizations.new(args, build_context_filters(id: org_id), opts),
            Projects.new(args, build_context_filters({ organization_id: org_id }, :projects), opts)
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
        context_api ||= Api[:idah].iam.organizations

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
          Delegate.new(:organizations, proc do |filter = {}|
            projects.index.flat_map { |p| p.organizations.index(filter) }
          end, args, filters, opts)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        Verse::logger.debug {{idah_apis: self, args:, context:, opts:}}
        organizations = Organizations.new(args, context, opts)
        projects = Projects.from_organizations(
          organizations,
          organizations.build_context_filters_from(args),
          organizations.build_context_filters_from(context),
          opts
        )
        project_members = ProjectMembers.from_projects(
          projects,
          projects.build_context_filters_from(args),
          projects.build_context_filters_from(context),
          opts
        )
        datasets = Datasets.from_projects(
          projects,
          projects.build_context_filters_from(args),
          projects.build_context_filters_from(context),
          opts
        )
        entries = Entries.from_datasets(
          datasets,
          datasets.build_context_filters_from(args),
          datasets.build_context_filters_from(context),
          opts
        )
        annotations = Annotations.from_entries(
          entries,
          entries.build_context_filters_from(args),
          entries.build_context_filters_from(context),
          opts
        )

        # Returns APIs ordered from top-level to leaf-level
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
