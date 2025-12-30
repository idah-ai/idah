module Context
  module IdahApi
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
              Datasets.new(args, {datasets:{id__in:}}).index(filter)
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

      def self.idah_apis(args, context)
        datasets = Datasets.new(args, context)
        projects = Projects.from_datasets(datasets, args, context)
        organizations = Organizations.from_projects(projects, args, context)
        project_members = ProjectMembers.from_projects(projects, args, context)
        entries = Entries.from_datasets(datasets, args, context)
        annotations = Annotations.from_entries(entries, args, context)
        # create APIs back up from annotations to make filtering exclusive
        # or integrates query join/include accordingly on Datasets/Crud
        [organizations, projects, project_members, datasets, entries, annotations]
      end
    end
  end
end
