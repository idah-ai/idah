module Context
  module IdahContext
    class Datasets < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(args = {}, context_filters = {}, opts = {}, api_context = Api[:idah].dataset.datasets, &context_builder)
        super(
          api_context,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |dataset|
            Context.new(dataset,
              Datasets.new(args, merge_context_filters(id: dataset[:id])),
              Entries.new(args, merge_context_filters({dataset_id: dataset[:id]}, :entries))
            )
          end
        )
      end

      def self.from_entries(entries, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:datasets, proc do |filter = {}|
            dataset_ids = entries.index.map { |e| e.record[:attributes][:dataset_id] }.compact.uniq
            dataset_ids.each_slice(100).flat_map do |id__in|
              Idah::Datasets.new(args, {datasets:{id__in:}}).index(filter)
            end
          end)
        )
      end

      def self.from_projects(projects, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:datasets, proc do |filter = {}|
            projects.index.flat_map { |p| p.datasets.index(filter) }
          end)
        )
      end

    end
  end
end
