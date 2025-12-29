module Context
  module IdahContext
    class Annotations < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        api_context = Api[:idah].dataset.annotations,
        &context_builder
      )
        super(
          api_context,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |annotation|
            Context.new(
              annotation,
              Annotations.new(args, merge_context_filters(id: annotation[:id])),
              Entries.new(args, merge_context_filters({id: annotation[:attributes][:entry_id]}, :entries))
            )
          end
        )
      end

      def self.from_entries(entries, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:annotations, proc do |filter = {}|
            entries.index.flat_map { |e| e.annotations.index(filter) }
          end)
        )
      end
    end
  end
end
