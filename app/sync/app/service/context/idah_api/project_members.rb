module Context
  module IdahApi
    class ProjectMembers < Crud
      Context = Data.define(:record, :api, :projects, :datasets, :entries, :annotations)

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        context_api = Api[:idah].dataset.project_members,
        &context_builder
      )
        super(
          context_api,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |project_member|
            Context.new(project_member,
              ProjectMembers.new(args, merge_context_filters(id: project_member[:id])),
              Projects.new(args, merge_context_filters({id: project_member[:attributes][:project_id]}, :projects)),
              Datasets.new(args, merge_context_filters({id: project_member[:attributes][:project_id]}, :datasets)),
              Entries.new(args, merge_context_filters({id: project_member[:attributes][:project_id]}, :entries)),
              Annotations.new(args, merge_context_filters({id: project_member[:attributes][:project_id]}, :annotations))
            )
          end
        )
      end

      def self.from_projects(projects, args = {}, filters = {}, opts = {})
        new(
          args, filters, opts,
          Delegate.new(:projects_members, proc do |filter = {}|
            projects.index.flat_map { |p| p.project_members.index(filter) }
          end)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        project_members = ProjectMembers.new(args, context, opts)
        projects = Projects.from_project_members(project_members, args, context, opts)
        organizations = Organizations.from_projects(projects, args, context, opts)
        datasets = Datasets.from_projects(projects, args, context, opts)
        entries = Entries.from_datasets(datasets, args, context, opts)
        annotations = Entries.from_entries(entries, args, context, opts)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on ProjectMembers/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
