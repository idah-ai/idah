module Context
  module Idah
    class Organizations < Crud
      Context = Data.define(:record, :api)

      def initialize(
        args = {},
        context_filters = {},
        opts = {},
        context_api = Api[:idah].iam.organizations,
        &context_builder
      )
        super(
          context_api,
          args,
          context_filters,
          opts,
          context_builder ||= proc do |organization|
            Context.new(organization,
              Organizations.new(args, merge_context_filters(id: organization[:id]))
            )
          end
        )
      end
    end
  end
end
