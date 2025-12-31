module Context
  module IdahApi
    class Datasets < Crud
      Context = Data.define(:record, :api, :entries)

      def builder(dataset)
        dataset_id = dataset[:id]
        unless dataset_id
          raise Sync::Error::InvalidData, "Dataset missing id"
        end

        Context.new(
          super(dataset),
          Datasets.new(args, build_context_filters(id: dataset_id), opts),
          Entries.new(args, build_context_filters({ dataset_id: dataset_id }, :entries), opts)
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
        api_context ||= Api[:idah].dataset.datasets

        super(
          api_context,
          args,
          context_filters,
          opts,
          &context_builder
        )
      end

      def self.from_entries(entries, args = {}, filters = {}, opts = {})
        batch_size = opts[:batch_size] || 100

        new(
          entries.build_context_filters_from(args),
          entries.build_context_filters_from(filters),
          opts,
          Delegate.new(:datasets, proc do |filter = {}|
            dataset_ids = entries.index.map { |e| e.record.dig(:attributes, :dataset_id) }.compact.uniq
            dataset_ids.each_slice(batch_size).flat_map do |id__in|
              Datasets.new(args, { datasets: { id__in: } }, opts).index(filter)
            end
          end, args, filters, opts)
        )
      end

      def self.from_projects(projects, args = {}, filters = {}, opts = {})
        new(
          projects.build_context_filters_from(args),
          projects.build_context_filters_from(filters),
          opts,
          Delegate.new(:datasets, proc do |filter = {}|
            projects.index.flat_map { |p| p.datasets.index(filter) }
          end, args, filters, opts)
        )
      end

      def self.idah_apis(args = {}, context = {}, opts = {})
        Verse::logger.debug {{idah_apis: self, args:, context:, opts:}}
        datasets = Datasets.new(args, context, opts)
        projects = Projects.from_datasets(datasets, args, context, opts)
        organizations = Organizations.from_projects(projects, args, context, opts)
        project_members = ProjectMembers.from_projects(projects, args, context, opts)
        entries = Entries.from_datasets(datasets, args, context, opts)
        annotations = Annotations.from_entries(entries, args, context, opts)

        # Returns APIs ordered from top-level to leaf-level
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
