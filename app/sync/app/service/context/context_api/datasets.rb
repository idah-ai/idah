module Context
  module ContextApi
    class Datasets < Crud
      Context = Data.define(:dataset, :entries)

      def initialize(context_filters, args, api = Api[:idah])
        super(
          proc do |dataset|
            Context.new(dataset, Entries.new({dataset_id: dataset[:id]}, args, api))
          end, api.dataset.datasets,
          context_filters, args, api
        )
      end
    end
  end
end
