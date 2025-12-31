module Context
  module IdahApi
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def builder(entry)
        entry_id = entry[:id]
        unless entry_id
          raise Sync::Error::InvalidData, "Entry missing id"
        end

        dataset_id = entry.dig(:attributes, :dataset_id)
        unless dataset_id
          raise Sync::Error::InvalidData, "Entry missing dataset_id in attributes"
        end

        resource = entry.dig(:attributes, :resource)
        unless resource
          raise Sync::Error::InvalidData, "Entry missing resource in attributes"
        end

        Context.new(
          entry,
          Entries.new(args, build_context_filters(id: entry_id), opts),
          Datasets.new(args, build_context_filters({ id: dataset_id }, :datasets), opts),
          Medias.new(args, build_context_filters({ resource: resource }, :medias), opts),
          Annotations.new(args, build_context_filters({ entry_id: entry_id }, :annotations), opts)
        )
      end

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        api_context = nil,
        &context_builder
      )
        # Dependency injection: allow passing api_context for testing
        api_context ||= Api[:idah].dataset.entries

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
          datasets.build_context_filters_from(args),
          datasets.build_context_filters_from(filters),
          opts,
          Delegate.new(:entries, proc do |filter = {}|
            datasets.index.flat_map { |d| d.entries.index(filter) }
          end, args, filters, opts)
        )
      end

      def self.from_annotations(annotations, args = {}, filters = {}, opts = {})
        batch_size = opts[:batch_size] || 100

        new(
          annotations.build_context_filters_from(args),
          annotations.build_context_filters_from(filters),
          opts,
          Delegate.new(:entries, proc do |filter = {}|
            entry_ids = annotations.index.map { |a| a.record.dig(:attributes, :entry_id) }.compact.uniq
            entry_ids.each_slice(batch_size).flat_map do |id__in|
              Entries.new(args, { entries: { id__in: } }, opts).index(filter)
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

        # Returns APIs ordered from top-level to leaf-level
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end