module Context
  module IdahApi
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def builder(entry)
        Context.new(
          entry,
          Entries.new(args, build_context_filters(id: entry[:id])),
          Datasets.new(args, build_context_filters({id: entry[:attributes][:dataset_id]}, :datasets)),
          Medias.new(args, build_context_filters({resource: entry[:attributes][:resource]}, :medias)),
          Annotations.new(args, build_context_filters({entry_id: entry[:id]}, :annotations))
        )
      end

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
          &context_builder
        )
      end

      def self.from_datasets(datasets, args = {}, filters = {}, opts = {})
        new(
          datasets.build_context_filters_from(args), datasets.build_context_filters_from(filters), opts,
          Delegate.new(:entries, proc do |filter = {}|
            datasets.index.flat_map { |d| d.entries.index(filter) }
          end, args, filters, opts)
        )
      end

      def self.from_annotations(annotations, args = {}, filters = {}, opts = {})
        new(
          annotations.build_context_filters_from(args), annotations.build_context_filters_from(filters), opts,
          Delegate.new(:entries, proc do |filter = {}|
            entry_ids = annotations.index.map { |a| a.record[:attributes][:entry_id] }.compact.uniq
            entry_ids.each_slice(100).flat_map do |id__in|
              Entries.new(args, {entries:{id__in:}}).index(filter)
            end
          end, args, filters, opts)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        entries = Entries.new(args, context, opts)
        datasets = Datasets.from_entries(entries, args, context, opts)
        projects = Projects.from_datasets(datasets, args, context, opts)
        organizations = Organizations.from_projects(projects, args, context, opts)
        project_members = ProjectMembers.from_projects(projects, args, context, opts)
        annotations = Annotations.from_entries(entries, args, context, opts)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Entries/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
