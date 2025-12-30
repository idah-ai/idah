module Context
  module IdahContext
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
              Projects.new(args, merge_context_filters(id: project_member[:attributes][:project_id])),
              Datasets.new(args, merge_context_filters(id: project_member[:attributes][:project_id])),
              Entries.new(args, merge_context_filters(id: project_member[:attributes][:project_id])),
              Annotations.new(args, merge_context_filters(id: project_member[:attributes][:project_id]))
            )
          end
        )
      end

      def self.from_projects(projects, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:projects_members, proc do |filter = {}|
            projects.index.flat_map { |p| p.project_members.index(filter) }
          end)
        )
      end

      def self.idah(args, context)
        project_members = ProjectMembers.new(args, context)
        projects = Projects.from_project_members(project_members, args, context)
        organizations = Organizations.from_projects(projects, args, context)
        datasets = Datasets.from_projects(projects, args, context)
        entries = Entries.from_datasets(datasets, args, context)
        annotations = Entries.from_entries(entries, args, context)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on ProjectMembers/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
