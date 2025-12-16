module Context
  module ContextApi
    class Datasets < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {})
        super(
          Hash(opts)[:feedback] ? api : Api[api].dataset.datasets,
          api,
          args,
          context_filters,
          opts,
          proc do |dataset|
            Context.new(dataset,
              Datasets.new(api, args, merge_context_filters(id: dataset[:id])),
              Entries.new(api, args, merge_context_filters({dataset_id: dataset[:id]}, :entries))
            )
          end
        )
      end
    end
  end
end
