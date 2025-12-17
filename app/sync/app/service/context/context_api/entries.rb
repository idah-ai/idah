module Context
  module ContextApi
    class Entries < Crud
      Context = Data.define(:record, :api, :datasets, :medias, :annotations)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {}, &context_builder)
        Verse::logger.debug {["INIT ENTRY CONTEXT", context_builder]}
        context_builder ||= proc do |dataset|
            Context.new(
              entry,
              Entries.new(api, args, merge_context_filters(id: entry[:id])),
              Datasets.new(api, args, merge_context_filters({id: entry[:attributes][:dataset_id]}, :datasets)),
              Medias.new(api, args, merge_context_filters({resource: entry[:attributes][:resource]}, :medias)),
              Annotations.new(api, args, merge_context_filters({entry_id: entry[:id]}, :annotations))
            )
          end
        Verse::logger.debug {["ENTRY SUPER WITH", context_builder]}
        super(
          Api[api].dataset.entries,
          api,
          args,
          context_filters,
          opts,
          &context_builder
        )
      end
    end
  end
end
