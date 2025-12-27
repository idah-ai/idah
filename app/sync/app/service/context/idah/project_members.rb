module Context
  module Idah
    class ProjectMembers < Crud
      Context = Data.define(:record, :api, :projects, :datasets, :entries, :annotations)

      def initialize(args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |project_member|
          Context.new(project_member,
            ProjectMembers.new(args, merge_context_filters(id: project_member[:id])),
            Projects.new(args, merge_context_filters(id: project_member[:attributes][:project_id])),
            Datasets.new(args, merge_context_filters(id: project_member[:attributes][:project_id])),
            Entries.new(args, merge_context_filters(id: project_member[:attributes][:project_id])),
            Annotations.new(args, merge_context_filters(id: project_member[:attributes][:project_id]))
          )
        end
        super(
          Api[:idah].dataset.project_members,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
