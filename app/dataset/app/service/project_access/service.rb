# frozen_string_literal: true

module ProjectAccess
  # Resolves the effective access an actor has on a concrete project, using the
  # system repositories so the result does not depend on repository scoping.
  #
  # Returns one of:
  #   :all          — admin/system (unrestricted)
  #   :org_owner    — the project is in one of the actor's orgs
  #   <role symbol> — the actor's enabled membership role on the project
  #   :none         — no access
  #
  # The actor's identity is passed explicitly: org ids come from
  # `auth_context.custom_scopes[:org]`, account id from `auth_context.metadata[:id]`.
  # When `auth_context.custom_scopes[:project]` is present (API keys), only those
  # projects can resolve to anything other than :none.
  #
  # The whole resolution runs inside `auth_context.can!(action, resource)` so the
  # context is marked as checked (no "authorization context hasn't been checked"
  # errors) and the branch is chosen by the actor's right, not by role name.
  class Service
    class << self
      def resolve(auth_context, project_id, action:, resource:)
        auth_context.can!(action, resource) do |scope|
          scope.all? { :all }

          scope.as_org_owner? do
            project_scope = auth_context.custom_scopes[:project]
            if project_scope
              # API-key project scope: no membership union.
              Array(project_scope).map(&:to_s).include?(project_id.to_s) ? :org_owner : :none
            else
              org_ids = auth_context.custom_scopes[:org]
              if org_ids&.any?
                project = system_projects.find_by({ id: project_id })
                if project && org_ids.map(&:to_s).include?(project.organization_id.to_s)
                  :org_owner
                else
                  membership_role(auth_context, project_id)
                end
              else
                membership_role(auth_context, project_id)
              end
            end
          end

          scope.as_user? { membership_role(auth_context, project_id) }

          # No matching right (e.g. `own`): no access. Return :none so can! does
          # not reject by itself; callers keep their own errors.
          scope.else? { :none }
        end
      end

      # The effective rank of the actor on the project (via RoleHierarchy), or nil
      # when the actor has no access.
      def effective_rank(auth_context, project_id, action:, resource:)
        access = resolve(auth_context, project_id, action:, resource:)
        return nil if access == :none

        case access
        when :all then RoleHierarchy.rank("system")
        when :org_owner then RoleHierarchy.rank("org_owner")
        else RoleHierarchy.rank(access)
        end
      end

      def system_projects
        Project::Repository.new(Verse::Auth::Context[:system])
      end

      def system_project_members
        ProjectMember::Repository.new(Verse::Auth::Context[:system])
      end

      private

      def membership_role(auth_context, project_id)
        membership = system_project_members.find_by(
          { project_id:, account_id: auth_context.metadata[:id], enabled: true }
        )
        membership&.role&.to_sym || :none
      end
    end
  end
end
