module Context
  module ContextApi
    class Entries < Crud
      Context = Data.define(:entry, :medias, :annotations)

      def initialize(context_filters, args, api = Api[:idah])
        super(
          proc do |entry|
            Context.new(
              entry,
              Medias.new({resource: entry[:attributes][:resource]}, args, api),
              Annotations.new({entry_id: entry[:id]}, args, api))
          end, api.dataset.entries,
          context_filters, args, api)
      end
    end
  end
end
