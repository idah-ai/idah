module Context
  module ContextApi
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def initialize(api = :idah, args = {}, context_filters = {})
        super(
          Api[api].dataset.entries,
          api,
          args,
          context_filters,
          proc do |entry|
            Context.new(
              entry,
              Entries.new(api, args, merge_context_filters(id: entry[:id])),
              Datasets.new(api, args, merge_context_filters({id: entry[:attributes][:dataset_id]}, :datasets)),
              Medias.new(api, args, merge_context_filters({resource: entry[:attributes][:resource]}, :medias)),
              Annotations.new(api, args, merge_context_filters({entry_id: entry[:id]}, :annotations))
            )
          end
        )
      end
    end
  end
end
