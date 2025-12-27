module Context
  module Idah
    class Organizations < Crud
      Context = Data.define(:record, :api)

      def initialize(args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |organization|
          Context.new(organization,
            Organizations.new(args, merge_context_filters(id: organization[:id]))
          )
        end
        super(
          Api[:idah].iam.organizations,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
