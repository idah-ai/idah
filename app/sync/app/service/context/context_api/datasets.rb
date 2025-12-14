module Context
  module ContextApi
    class Datasets < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(context_filters, args, api = :idah)
        super(
          proc do |dataset|
            Context.new(dataset,
              Datasets.new({id: dataset[:id]}, args, api),
              Entries.new({dataset_id: dataset[:id]}, args, api)
            )
          end, Api[api].dataset.datasets,
          context_filters, args, api
        )
      end
    end
  end
end
