module Context
  module IdahContext
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        api_context = Api[:idah].dataset.entries,
        &context_builder
      )
        super(
          api_context,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |entry|
            Context.new(
              entry,
              Entries.new(args, merge_context_filters(id: entry[:id])),
              Datasets.new(args, merge_context_filters({id: entry[:attributes][:dataset_id]}, :datasets)),
              Medias.new(args, merge_context_filters({resource: entry[:attributes][:resource]}, :medias)),
              Annotations.new(args, merge_context_filters({entry_id: entry[:id]}, :annotations))
            )
          end
        )
      end

      def self.from_datasets(datasets, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:entries, proc do |filter = {}|
            datasets.index.flat_map { |d| d.entries.index(filter) }
          end)
        )
      end

      def self.from_annotations(annotations, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:entries, proc do |filter = {}|
            entry_ids = annotations.index.map { |a| a.record[:attributes][:entry_id] }.compact.uniq
            entry_ids.each_slice(100).flat_map do |id__in|
              Entries.new(args, {entries:{id__in:}}).index(filter)
            end
          end)
        )
      end

      def self.idah(args, context)
        entries = Entries.new(args, context)
        datasets = Datasets.from_entries(entries, args, context)
        projects = Projects.from_datasets(datasets, args, context)
        organizations = Organizations.from_projects(projects, args, context)
        project_members = ProjectMembers.from_projects(projects, args, context)
        annotations = Annotations.from_entries(entries, args, context)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Entries/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
