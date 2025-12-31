module Context
  module IdahApi
    class Organizations < Crud
      Context = Data.define(:record, :api, :projects)

      def builder(organization)
        Context.new(organization,
          Organizations.new(args, build_context_filters(id: organization[:id])),
          Projects.new(args, build_context_filters({organization_id: organization[:id]}, :projects))
        )
      end

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        context_api = Api[:idah].iam.organizations,
        &context_builder
      )
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
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Organizations/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
