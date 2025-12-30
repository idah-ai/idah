module Context
  module IdahApi
    class Annotations < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        api_context = Api[:idah].dataset.annotations,
        &context_builder
      )
        super(
          api_context,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |annotation|
            Context.new(
              annotation,
              Annotations.new(args, merge_context_filters(id: annotation[:id])),
              Entries.new(args, merge_context_filters({id: annotation[:attributes][:entry_id]}, :entries))
            )
          end
        )
      end

      def self.from_entries(entries, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:annotations, proc do |filter = {}|
            entries.index.flat_map { |e| e.annotations.index(filter) }
          end)
        )
      end

      def self.idah_apis(args, context)
        annotations = Annotations.new(args, context)
        entries = Entries.from_annotations(annotations, args, context)
        datasets = Datasets.from_entries(entries, args, context)
        projects = Projects.from_datasets(datasets, args, context)
        organizations = Organizations.from_projects(projects, args, context)
        project_members = ProjectMembers.from_projects(projects, args, context)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Annotations/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
