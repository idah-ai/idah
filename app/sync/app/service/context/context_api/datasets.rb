module Context
  module ContextApi
    class Datasets < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |dataset|
            puts {{self: self, dataset:}}
            Context.new(dataset,
              Datasets.new(api, args, merge_context_filters(id: dataset[:id])),
              Entries.new(api, args, merge_context_filters({dataset_id: dataset[:id]}, :entries))
            )
          end
        super(
          Api[api].dataset.datasets,
          api,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
