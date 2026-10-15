# frozen_string_literal: true

module ProjectMember
  class Service < Verse::Service::Base
    use project_members: ProjectMember::Repository,
        projects: Project::Repository

    use_system system_project_members: ProjectMember::Repository,
               system_entries: Entry::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      project_members.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      project_members.find!(id, included: included)
    end

    def update(record)
      member = project_members.find!(record.id)

      # Only `role` and `disabled_at` are accepted on update; name/email are
      # server-maintained (synced from IAM).
      attrs = record.attributes.slice(:role, :disabled_at)

      # Managing an existing member requires effective rank >= the member's role,
      # for ANY update (role change or disable).
      effective_rank = ProjectAccess::Service.effective_rank(
        auth_context, member.project_id, action: :update, resource: project_members.class.resource
      )
      unless effective_rank && RoleHierarchy.can_manage_project_member?(effective_rank, member.role)
        raise Verse::Error::Unauthorized,
              "You do not have permission to update a member for this project"
      end

      if attrs.key?(:role)
        role = attrs[:role]
        unless RoleHierarchy.project_roles.include?(role)
          raise Verse::Error::ValidationFailed, "Invalid project member role `#{role}`"
        end

        # Assigning project_owner requires effective rank >= org_owner.
        if role == "project_owner" && effective_rank < RoleHierarchy.rank("org_owner")
          raise Verse::Error::Unauthorized,
                "You do not have permission to update a member to a project owner for this project"
        end
      end

      project_members.update!(record.id, attrs)
      project_members.find!(record.id)
    end

    def delete(id)
      project_members.transaction do
        member = project_members.find!(id, included: [:project])

        effective_rank = ProjectAccess::Service.effective_rank(
          auth_context, member.project_id, action: :delete, resource: project_members.class.resource
        )
        unless effective_rank && RoleHierarchy.can_manage_project_member?(effective_rank, member.role)
          raise Verse::Error::Unauthorized,
                "You do not have permission to delete a member for this project"
        end

        # Soft delete project member
        project_members.update!(member.id, { disabled_at: Time.now })
        project_members.after_commit do
          ::Service::Notification.email(
            to: member.email,
            title: "You have been removed from the project '#{member.project.name}'",
            category: "project_member_removed",
            type: "notification:project:activities",
            project_id: member.project_id,
            project_name: member.project.name,
            remover_email: auth_context.metadata[:email],
            remover_name: auth_context.metadata[:name],
          )
        end
      end
    end

    # Batch invite members to a project. All-or-nothing: validates every member
    # first (read-only); if any fails, writes nothing and returns a per-index
    # reason. Only if all are valid does it call the IAM invite and write
    # memberships in one transaction.
    def invite(project_id, members:)
      project = system_projects.find!(project_id)
      effective_rank = ProjectAccess::Service.effective_rank(
        auth_context, project_id, action: :invite, resource: project_members.class.resource
      )

      unless effective_rank && effective_rank >= RoleHierarchy.rank("project_owner")
        raise Verse::Error::Unauthorized,
              "You do not have permission to invite members to this project"
      end

      # Validate every member without writing anything.
      errors = {}
      validated = []

      members.each_with_index do |m, index|
        email = (m[:email] || m["email"]).to_s.strip
        role = (m[:role] || m["role"]).to_s

        if email.empty?
          errors["members/#{index}"] = ["email is required"]
          next
        end
        unless RoleHierarchy.project_roles.include?(role)
          errors["members/#{index}"] = ["invalid role `#{role}`"]
          next
        end
        unless RoleHierarchy.can_assign_project_role?(effective_rank, role)
          errors["members/#{index}"] = ["you cannot assign role `#{role}`"]
          next
        end

        validated << { email:, role:, index: }
      end

      # Duplicate emails in the batch, then resolve existing accounts and reject
      # disabled / already-active members, and validate re-invite authorisation
      # for existing (disabled) rows.
      seen = {}
      validated.each do |m|
        if seen[m[:email]]
          errors["members/#{m[:index]}"] = ["duplicate email in batch"]
          next
        end
        seen[m[:email]] = true

        account = find_account_by_email(m[:email])
        if account && !account.enabled
          errors["members/#{m[:index]}"] =
            ["Cannot invite a disabled account; an administrator or org owner must re-enable it"]
          next
        end

        existing = account && system_project_members.find_by(
          { project_id: project.id, account_id: account.id }
        )

        if existing && existing.disabled_at.nil?
          errors["members/#{m[:index]}"] = ["This account is already an active member of the project"]
          next
        end

        # Re-invite of a removed member: authorisation must allow managing the
        # row's CURRENT role and assigning the new role.
        if existing && !can_reinvite_member?(effective_rank, existing, m[:role])
          errors["members/#{m[:index]}"] = ["You do not have permission to re-invite this member"]
          next
        end

        m[:account] = account
        m[:existing] = existing
      end

      raise Verse::Error::ValidationFailed, errors_object(errors) unless errors.empty?

      # Only if all valid, call the IAM invite and write memberships in one
      # transaction. "Added to project" emails fire in after_commit.
      project_members.transaction do
        validated.map do |m|
          invite_single(project, m[:email], m[:role], m[:account], m[:existing])
        end
      end
    end

    # Resend a project member invitation. Guarded by the project-level resend
    # rule, then delegates to the IAM resend with the service token.
    def resend_invitation(id)
      member = system_project_members.find!(id, included: [:project])

      effective_rank = ProjectAccess::Service.effective_rank(
        auth_context, member.project_id, action: :invite, resource: project_members.class.resource
      )
      unless effective_rank && RoleHierarchy.can_manage_project_member?(effective_rank, member.role)
        raise Verse::Error::Unauthorized,
              "You do not have permission to resend this invitation"
      end

      # Reject accounts that already joined.
      account = Api[:idah].iam.accounts.show(id: member.account_id)
      if account.joined_at
        raise Verse::Error::Unauthorized,
              "This account has already joined; no invitation to resend"
      end
      unless account.enabled
        raise Verse::Error::Unauthorized,
              "Cannot resend invitation for a disabled account; an administrator or org owner must re-enable it"
      end

      Api[:idah].iam.accounts.resend_invitation(id: member.account_id)
      member
    end

    def delete_account_members(account_id, actor_metadata = nil)
      system_project_members.chunked_index({ account_id: account_id }).each do |member|
        system_project_members.with_actor(actor_metadata) do
          system_project_members.delete!(member.id)
        end
      end
    end

    def disable_account_members(account_id, actor_metadata = nil)
      now = Time.now
      system_project_members.chunked_index({ account_id: account_id }).each do |member|
        system_project_members.with_actor(actor_metadata) do
          system_project_members.update!(member.id, { disabled_at: now })
        end
      end
    end

    private

    def system_projects
      Project::Repository.new(Verse::Auth::Context[:system])
    end

    # Resolves an account by email with the service token (read-only). Returns
    # the account record or nil when no account exists yet. Emails are matched
    # exactly as typed.
    def find_account_by_email(email)
      Api[:idah].iam.accounts.index(
        filter: { email: email }
      ).data.first
    end

    # Wraps the per-index errors so Verse::Error::ValidationFailed renders one
    # error per member (source.pointer = /members/<index>).
    def errors_object(errors)
      Struct.new(:errors).new(errors)
    end

    # Whether the actor may re-invite an existing (removed) member: they must be
    # able to manage the row's CURRENT role and to assign the requested role.
    def can_reinvite_member?(effective_rank, existing, requested_role)
      RoleHierarchy.can_manage_project_member?(effective_rank, existing.role) &&
        RoleHierarchy.can_assign_project_role?(effective_rank, requested_role)
    end

    # Writes a single membership. The account and the existing row (if any) were
    # already resolved and validated. If a disabled row exists for
    # (project_id, account_id) it is re-enabled (re-invite of a removed member);
    # otherwise a new row is created. The IAM invite with role_name "user" and an
    # empty scope is a no-op for existing accounts and creates new ones.
    def invite_single(project, email, role, account, existing)
      account ||= Api[:idah].iam.accounts.invite(
        attributes: { email:, role_name: "user", role_scope: {} }
      )

      # Membership writes run through a plain system repository; only the emitted
      # dataset:project_members events carry the inviter (via `with_actor`). The
      # IAM invite itself is attributed to the service account.
      if existing
        # Re-invite of a removed member: re-enable the existing row.
        system_project_members.with_actor(auth_context) do
          system_project_members.update!(
            existing.id,
            { role:, disabled_at: nil, name: account.name, email: account.email }
          )
        end
        member = system_project_members.find!(existing.id, included: [:project])
      else
        member_id = nil
        system_project_members.with_actor(auth_context) do
          member_id = system_project_members.create(
            project_id: project.id,
            account_id: account.id,
            name: account.name,
            email: account.email,
            role: role,
            invited_by_id: auth_context.metadata[:id]
          )
        end
        member = system_project_members.find!(member_id, included: [:project])

        # "Added to project" email fires in after_commit (new rows only, and only
        # when the account has joined).
        project_members.after_commit do
          next unless account.joined_at.nil? == false

          ::Service::Notification.email(
            to: member.email,
            title: "You have been assigned to the project '#{member.project.name}'",
            category: "project_member_added",
            type: "notification:project:activities",
            project_id: member.project_id,
            project_name: member.project.name,
            inviter_email: auth_context.metadata[:email],
            inviter_name: auth_context.metadata[:name],
          )
        end
      end

      member
    end
  end
end
