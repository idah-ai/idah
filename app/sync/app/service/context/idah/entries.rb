module Context
  module Idah
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        api_context = Api[:idah].dataset.entries,
        &context_builder
      )
        super(
          api_context,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |entry|
            Context.new(
              entry,
              Entries.new(args, merge_context_filters(id: entry[:id])),
              Datasets.new(args, merge_context_filters({id: entry[:attributes][:dataset_id]}, :datasets)),
              Medias.new(args, merge_context_filters({resource: entry[:attributes][:resource]}, :medias)),
              Annotations.new(args, merge_context_filters({entry_id: entry[:id]}, :annotations))
            )
          end
        )
      end
    end
  end
end
