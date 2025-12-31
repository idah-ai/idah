module Context
  module IdahApi
    class Annotations < Crud
      Context = Data.define(:record, :api, :entries)

      def builder(annotation)
        # Validate required nested attributes
        entry_id = annotation.dig(:attributes, :entry_id)
        unless entry_id
          raise Sync::Error::InvalidData, "Annotation missing entry_id in attributes"
        end

        Context.new(
          annotation,
          Annotations.new(args, build_context_filters(id: annotation[:id]), opts),
          Entries.new(args, build_context_filters({ id: entry_id }, :entries), opts)
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
        api_context ||= Api[:idah].dataset.annotations

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
          entries.build_context_filters_from(args),
          entries.build_context_filters_from(filters),
          opts,
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

        # Returns APIs ordered from top-level to leaf-level
        # This ordering ensures proper filter cascading
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end