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
              Projects.new(args, merge_context_filters(organization_id: organization[:id]))
            )
          end
        )
      end

      def self.from_projects(projects, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:entries, proc do |filter = {}|
            projects.index.flat_map { |p| p.organizations.index(filter) }
          end)
        )
      end

      def self.idah_apis(args, context)
        organizations = Organizations.new(args, context)
        projects = Projects.from_organizations(organizations, args, context)
        project_members = ProjectMembers.from_projects(projects, args, context)
        datasets = Datasets.from_projects(projects, args, context)
        entries = Entries.from_datasets(datasets, args, context)
        annotations = Annotations.from_entries(entries, args, context)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Organizations/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
