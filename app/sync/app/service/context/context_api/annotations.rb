module Context
  module ContextApi
    class Annotations < Crud
      Context = Data.define(:record, :api, :entries)

      def initialize(context_filters, args, api = :idah)
        super(
          proc do |annotation|
            Context.new(
              annotation,
              Annotations.new({id: annotation[:id]}, args, api),
              Entries.new({id: annotation[:attributes][:entry_id]}, args, api)
            )
          end, Api[api].dataset.annotations,
          context_filters, args, api)
      end
    end
  end
end
