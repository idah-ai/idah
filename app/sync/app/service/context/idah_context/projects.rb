module Context
  module IdahContext
    class Projects < Crud
      Context = Data.define(:record, :api, :members, :datasets, :entries, :annotations)

      def initialize(args = {}, context_filters = {}, opts = {}, context_api, &context_builder)
        super(
          context_api,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |project|
            Context.new(project,
              Projects.new(args, merge_context_filters(id: project[:id])),
              ProjectMembers.new(args, merge_context_filters(project_id: project[:id])),
              Datasets.new(args, merge_context_filters(project_id: project[:id])),
              Entries.new(args, merge_context_filters(project_id: project[:id])),
              Annotations.new(args, merge_context_filters(project_id: project[:id])),
            )
          end
        )
      end
    end
  end
end
