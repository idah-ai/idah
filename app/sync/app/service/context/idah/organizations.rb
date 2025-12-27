module Context
  module Idah
    class Organizations < Crud
      Context = Data.define(:record, :api)

      def initialize(api = :idah, args = {}, context_filters = {}, opts = {}, &context_builder)
        context_builder ||= proc do |organization|
          Context.new(organization,
            Organizations.new(api, args, merge_context_filters(id: organization[:id]))
          )
        end
        super(
          Api[api].iam.organizations,
          api,
          args,
          context_filters,
          opts,
          context_builder
        )
      end
    end
  end
end
