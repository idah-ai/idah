module Context
  module Idah
    class Projects < Crud
      Context = Data.define(:record, :api, :members, :datasets, :entries, :annotations)

      def initialize(args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |project|
          Context.new(project,
            Projects.new(args, merge_context_filters(id: project[:id])),
            ProjectMembers.new(args, merge_context_filters(project_id: project[:id])),
            Datasets.new(args, merge_context_filters(project_id: project[:id])),
            Entries.new(args, merge_context_filters(project_id: project[:id])),
            Annotations.new(args, merge_context_filters(project_id: project[:id])),
          )
        end
        super(
          Api[:idah].dataset.projects,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
