module Context
  module ContextApi
    module Dataset
      class ProjectMembers < Base
        def builder(project_members)
          super_project_members = super(project_members)
          return unless super_project_members

          super_project_members.lazy.map do |project_member|
            id = project_member.dig(:id)
            unless id
              raise Context::Error::InvalidData, "ProjectMember missing id"
            end

            project_id = project_member.dig(:attributes, :project_id)
            unless project_id
              raise Context::Error::InvalidData, "ProjectMember missing project_id in attributes"
            end

            filters = build_context_args({
              project_members: { id: }, projects: {id: project_id}
            })

            Unit.new(
              super(project_member), [
                Projects.new(@args, filters, **@opts),
              ], @args, filters, **@opts
            )
          end
        end

        def initialize(
          args = nil,
          context_args = nil,
          delegated_obj = nil,
          **opts,
          &context_builder
        )
          super(
            delegated_obj || Api[:idah].dataset.project_members,
            args,
            context_args,
            **opts,
            &context_builder
          )
        end
      end
    end
  end
end
