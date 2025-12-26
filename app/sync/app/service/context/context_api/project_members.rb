module Context
  module ContextApi
    class ProjectMembers < Crud
      Context = Data.define(:record, :api, :projects, :datasets, :entries, :annotations)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |project_member|
          Context.new(project_member,
            ProjectMembers.new(api, args, merge_context_filters(id: project_member[:id])),
            Projects.new(api, args, merge_context_filters(id: project_member[:attributes][:project_id])),
            Datasets.new(api, args, merge_context_filters(id: project_member[:attributes][:project_id])),
            Entries.new(api, args, merge_context_filters(id: project_member[:attributes][:project_id])),
            Annotations.new(api, args, merge_context_filters(id: project_member[:attributes][:project_id]))
          )
        end
        super(
          Api[api].dataset.project_members,
          api,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
