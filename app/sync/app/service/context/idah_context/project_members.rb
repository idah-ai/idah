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
          args, filters, { delegated: true },
          Delegated.new(:projects_members, proc do |filter = {}|
            projects.index.flat_map { |p| p.project_members.index(filter) }
          end)
        )
      end
    end
  end
end
