module Context
  module IdahContext
    class Organizations < Crud
      Context = Data.define(:record, :api, :projects)

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
              Organizations.new(args, merge_context_filters(id: organization[:id])),
              Projects.new(args, merge_context_filters(organization_id: organization[:id]))
            )
          end
        )
      end

      def self.from_projects(projects, args = {}, filters = {})
        new(
          args, filters, {},
          Delegate.new(:entries, proc do |filter = {}|
            projects.index.flat_map { |p| p.organizations.index(filter) }
          end)
        )
      end
    end
  end
end
