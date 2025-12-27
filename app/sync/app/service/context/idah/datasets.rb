module Context
  module Idah
    class Datasets < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |dataset|
            Context.new(dataset,
              Datasets.new(args, merge_context_filters(id: dataset[:id])),
              Entries.new(args, merge_context_filters({dataset_id: dataset[:id]}, :entries))
            )
          end
        super(
          Api[:idah].dataset.datasets,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
