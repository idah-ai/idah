module Context
  module ContextApi
    module Iam
      class Organizations < Base
        def builder(organizations)
          super(organizations)&.map do |organization|
            id = organization.dig(:id)
            unless id
              raise Context::Error::InvalidData, "Organization missing id"
            end

            filters = build_context_args({
              organizations: {id:}, projects: {organization_id: id}
            })

            Unit.new(
              organization, [
                ContextApi::Dataset::Projects.new(@args, filters, @pts)
              ], @args, filters, @opts
            )
          end
        end

        def initialize(
          args = nil,
          context_args = nil,
          opts = nil,
          delegated_obj = nil,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].iam.organizations,
            args,
            context_args,
            opts,
            &context_builder
          )
        end

        def self.root_api(args = nil, context = nil, opts = nil)
          organizations = ContextApi::Iam::Organizations.new(args, context, opts)
          projects = ContextApi::Dataset::Projects.from_organizations(
            organizations,
            organizations.build_context_args(args),
            organizations.build_context_args(context),
            opts
          )
          datasets = ContextApi::Dataset::Datasets.from_projects(
            projects,
            projects.build_context_args(args),
            projects.build_context_args(context),
            opts
          )

          datasets
        end
      end
    end
  end
end
