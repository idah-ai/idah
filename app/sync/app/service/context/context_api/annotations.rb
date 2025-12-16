module Context
  module ContextApi
    class Annotations < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {})
        super(
          Hash(opts)[:feedback] ? api : Api[api].dataset.annotations,
          api,
          args,
          context_filters,
          opts,
          proc do |annotation|
            Context.new(
              annotation,
              Annotations.new(api, args, merge_context_filters(id: annotation[:id])),
              Entries.new(api, args, merge_context_filters({id: annotation[:attributes][:entry_id]}, :entries))
            )
          end
        )
      end
    end
  end
end
