module Context
  module ContextApi
    class Annotations < Crud
      Context = Data.define(:annotation)

      def initialize(context_filters, args, api = Api[:idah])
        super(
          proc do |annotation|
            Context.new(annotation)
          end, api.dataset.annotations,
          context_filters, args, api)
      end
    end
  end
end
