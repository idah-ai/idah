module Context
  module ContextApi
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def initialize(context_filters, args, api = :idah)
        super(
          proc do |entry|
            Context.new(
              entry,
              Entries.new({id: entry[:id]}, args, api),
              Datasets.new({id: entry[:attributes][:dataset_id]}, args, api),
              Medias.new({resource: entry[:attributes][:resource]}, args, api),
              Annotations.new({entry_id: entry[:id]}, args, api))
          end, Api[api].dataset.entries,
          context_filters, args, api)
      end
    end
  end
end
