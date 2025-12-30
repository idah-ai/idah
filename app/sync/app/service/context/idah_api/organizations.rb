module Context
  module IdahApi
    class Organizations < Crud
      Context = Data.define(:record, :api, :projects)

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
          context_builder ||= proc do |organization|
            Context.new(organization,
              Organizations.new(args, merge_context_filters(id: organization[:id])),
              Projects.new(args, merge_context_filters({organization_id: organization[:id]}, :projects))
            )
          end
        )
      end

      def self.from_projects(projects, args = {}, filters = {}, opts = {})
        new(
          projects.merge_context_filters(args),
          projects.merge_context_filters(filters),
          opts,
          Delegate.new(:entries, proc do |filter = {}|
            projects.index.flat_map { |p| p.organizations.index(filter) }
          end)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        organizations = Organizations.new(args, context, opts)
        projects = Projects.from_organizations(
          organizations,
          organizations.merge_context_filters(args),
          organizations.merge_context_filters(context),
          opts
        )
        project_members = ProjectMembers.from_projects(
          projects,
          projects.merge_context_filters(args),
          projects.merge_context_filters(context),
          opts
        )
        datasets = Datasets.from_projects(
          projects,
          projects.merge_context_filters(args),
          projects.merge_context_filters(context),
          opts
        )
        entries = Entries.from_datasets(
          datasets,
          datasets.merge_context_filters(args),
          datasets.merge_context_filters(context),
          opts
        )
        annotations = Annotations.from_entries(
          entries,
          entries.merge_context_filters(args),
          entries.merge_context_filters(context),
          opts
        )
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Organizations/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
