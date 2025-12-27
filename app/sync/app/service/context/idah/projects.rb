module Context
  module Idah
    class Projects < Crud
      Context = Data.define(:record, :api, :members, :datasets, :entries, :annotations)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |project|
          Context.new(project,
            Projects.new(api, args, merge_context_filters(id: project[:id])),
            ProjectMembers.new(api, args, merge_context_filters(project_id: project[:id])),
            Datasets.new(api, args, merge_context_filters(project_id: project[:id])),
            Entries.new(api, args, merge_context_filters(project_id: project[:id])),
            Annotations.new(api, args, merge_context_filters(project_id: project[:id])),
          )
        end
        super(
          Api[api].dataset.projects,
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
