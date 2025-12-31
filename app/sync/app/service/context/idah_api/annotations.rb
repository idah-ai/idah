module Context
  module IdahApi
    class Annotations < Crud
      Context = Data.define(:record, :api, :entries)

      def builder(annotation)
        Context.new(
          annotation,
          Annotations.new(args, merge_context_filters(id: annotation[:id])),
          Entries.new(args, merge_context_filters({id: annotation[:attributes][:entry_id]}, :entries))
        )
      end

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
          &context_builder
        )
      end

      def self.from_entries(entries, args = {}, filters = {}, opts = {})
        new(
          entries.merge_args(args), entries.merge_args(filters), opts,
          Delegate.new(:annotations, proc do |filter = {}|
            entries.index.flat_map { |e| e.annotations.index(filter) }
          end, args, filters, opts)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        annotations = Annotations.new(args, context, opts)
        entries = Entries.from_annotations(annotations, args, context, opts)
        datasets = Datasets.from_entries(entries, args, context, opts)
        projects = Projects.from_datasets(datasets, args, context, opts)
        organizations = Organizations.from_projects(projects, args, context, opts)
        project_members = ProjectMembers.from_projects(projects, args, context, opts)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Annotations/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
