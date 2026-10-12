# frozen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository,
        organization_service: Organization::Service,
        role_change_notification: Account::RoleChangeNotification

    use_system accounts_system: Account::Repository

    # Roles that can be assigned through the public account creation path.
    # `system` is never assignable; `admin` is restricted to admin/system actors.
    ASSIGNABLE_ROLES = %w[user org_owner admin].freeze

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      accounts.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      accounts.find!(id, included: included)
    end

    # Only the system role may create accounts directly. Everyone else goes
    # through #invite. This is enforced in service code (not by narrowing
    # admin's rights), per the rights principle.
    def create(record, actor: nil)
      auth_context.can!(:create, accounts.class.resource) do |scope|
        scope.all? { true }

        scope.else? do
          raise Verse::Error::Unauthorized, "Only system can create accounts directly"
        end
      end

      # Whitelist the attributes a client may set on creation. Fields such as
      # `joined_at`, `sso_channel`, `picture_url`, `hashed_password` are
      # server-managed and must not be writable by the client.
      allowed = %i[name email role_name role_scope enabled password]
      attr = record.attributes.select { |k, _| allowed.include?(k) }

      role_name = (attr[:role_name] || "user").to_s
      unless ASSIGNABLE_ROLES.include?(role_name)
        raise Verse::Error::ValidationFailed, "Role `#{role_name}` is not assignable"
      end

      # role_scope is stored as JSON in the jsonb column.
      attr[:role_scope] = attr[:role_scope].to_json if attr.key?(:role_scope)

      accounts.transaction do
        # We use the system repository to check for existing accounts
        account = accounts_system.find_by({ email: attr[:email] })

        # If account with the email already exists, return it
        return account if account

        # Set a default random password for the account if none is provided
        password = attr.delete(:password) || SecureRandom.hex(16)

        # Generate invitation token and set invitation expiry date
        invitation_token = SecureRandom.hex(32)
        invitation_expired_at = Time.now + 3 * 24 * 60 * 60 # 3 days from now

        attr.merge!(
          hashed_password: BCrypt::Password.create(password),
          invitation_token:,
          invitation_expired_at:
        )

        # The write stays a plain system write; only the emitted event carries
        # the actor (the inviter) via `with_actor`.
        id = nil
        accounts.with_actor(actor) do
          id = accounts.create(attr)
        end

        # Use the system repository to avoid permission issues
        # As project membership will be created after account creation
        created_account = accounts_system.find!(id)

        # Send the join invitation email
        ::Service::Notification.email(
          to: created_account.email,
          title: "Account Created",
          category: "account_created",
          recipient_id: created_account.id,
          invitation_token:
        )

        created_account
      end
    end

    # Invite an account. Applies the account-level rules and the "invite on
    # existing email" table. Creation goes through a system-context Account::Service
    # so #create stays the only creation path.
    #
    # Accepts a plain attribute hash (the expo passes `params` directly) or a
    # JSON:API struct. Keys are normalized to symbols.
    def invite(record)
      # Guard first, like resend_invitation: the actor must hold the invite right.
      # The branch (all? → admin rules, as_org_owner? → org_owner rules) derives
      # the actor's level instead of trusting auth_context.role.
      actor_level = auth_context.can!(:invite, accounts.class.resource) do |scope|
        scope.all? { :admin }
        scope.as_org_owner? { :org_owner }
        scope.else? do
          raise Verse::Error::Unauthorized, "You do not have permission to invite an account"
        end
      end

      attrs = record.respond_to?(:attributes) ? record.attributes : record
      attrs = attrs.transform_keys(&:to_sym)
      email = attrs[:email]
      raise Verse::Error::ValidationFailed, "email is required to invite an account" if email.to_s.empty?

      target_role = (attrs[:role_name] || "user").to_s
      requested_scope = attrs[:role_scope]

      actor_role = actor_level.to_s
      actor_orgs = auth_context.custom_scopes[:org] || []

      # An actor may assign a role ranked strictly below their own, with the
      # admin → admin and org_owner → org_owner exceptions.
      unless RoleHierarchy.can_assign_account_role?(actor_role, target_role)
        raise Verse::Error::Unauthorized,
              "You do not have permission to invite an account with role `#{target_role}`"
      end

      accounts.transaction do
        existing = accounts_system.find_by({ email: email })

        if existing
          return invite_existing_account(existing, target_role, requested_scope, actor_role, actor_orgs)
        end

        # New account: create through a plain system context so #create stays the
        # only creation path. #create wraps its repository write in `with_actor`
        # so the emitted event is attributed to the inviter, while the write stays
        # a genuine system write.
        system_service = self.class.new(Verse::Auth::Context[:system])
        system_service.create(
          build_record(
            name: attrs[:name],
            email: email,
            role_name: target_role,
            role_scope: normalize_scope_for_create(target_role, requested_scope, actor_role, actor_orgs),
            enabled: true
          ),
          actor: auth_context
        )
      end
    end

    def update(record)
      actor_level = auth_context.can!(:update, accounts.class.resource) do |scope|
        scope.all? { :admin }
        scope.as_org_owner? { :org_owner }
        scope.own? { :self }
        scope.else? do
          raise Verse::Error::Unauthorized, "You do not have permission to update this account"
        end
      end

      accounts.transaction do
        previous_account = accounts.find!(record.id)

        attrs = record.attributes.dup
        actor_id = auth_context.metadata[:id]
        actor_role = actor_level.to_s

        if previous_account.id.to_s == actor_id.to_s
          # Self-update: only the name may change. Role, scope and enabled are
          # always rejected to prevent privilege escalation.
          unless (attrs.keys - [:name]).empty?
            raise Verse::Error::Unauthorized, "You can only update your own name"
          end
        else
          # The `own` branch resolves to `:self` only for the actor's own record.
          # A user can read co-members through the `as_user` read scope, but the
          # `own` update right never covers them: reject any other target here
          # rather than passing `"self"` to RoleHierarchy (which would raise
          # ArgumentError → 500).
          if actor_level == :self
            raise Verse::Error::Unauthorized, "You do not have permission to update this account"
          end

          # Role change and enabled toggle require the actor to strictly outrank
          # the target's CURRENT role (admin → admin allowed). The only peer
          # allowance is the org_owner scope delta within the actor's own orgs
          # (merge_role_scope). "Within reach" = the target is in the actor's
          # repository update scope (accounts.scoped(:update)).
          if attrs.key?(:enabled)
            unless can_change_account_role?(actor_role, previous_account.role_name) &&
                   within_update_scope?(previous_account)
              raise Verse::Error::Unauthorized,
                    "You do not have permission to change this account's enabled state"
            end
          end

          if attrs.key?(:role_name)
            target_role = attrs[:role_name].to_s

            # A role_name equal to the target's current role is a no-op (e.g. the
            # org-owner removal flow sends role_name unchanged alongside the new
            # scope); skip the role check entirely.
            unless target_role == previous_account.role_name.to_s
              unless can_change_account_role?(actor_role, previous_account.role_name) &&
                     within_update_scope?(previous_account) &&
                     RoleHierarchy.can_assign_account_role?(actor_role, target_role)
                raise Verse::Error::Unauthorized,
                      "You do not have permission to assign role `#{target_role}`"
              end
            end
          end

          if attrs.key?(:role_scope)
            # Scope changes allow the org_owner → org_owner peer allowance.
            unless RoleHierarchy.can_assign_account_role?(actor_role, previous_account.role_name) &&
                   within_update_scope?(previous_account)
              raise Verse::Error::Unauthorized,
                    "You do not have permission to change this account's scope"
            end

            merged = RoleHierarchy.merge_role_scope(
              actor_role: actor_role,
              actor_scope: actor_orgs,
              current: previous_account.role_scope,
              requested: attrs[:role_scope]
            )
            attrs[:role_scope] = merged
          end
        end

        # Normalize role_scope for storage (string keys, string org ids, deduped).
        attrs[:role_scope] = normalize_scope_for_storage(attrs[:role_scope]) if attrs.key?(:role_scope)

        accounts.update!(record.id, attrs)
        updated_account = accounts.find!(record.id)

        # Auto-demote an org_owner whose org list becomes empty.
        updated_account = demote_org_owner_without_orgs(updated_account) if updated_account.role_name == "org_owner"

        accounts.after_commit do
          role_change_notification.deliver!(previous_account:, updated_account:)
        end

        updated_account
      end
    end

    def delete(id)
      account = accounts.find!(id)

      if account.joined_at
        raise Verse::Error::Unauthorized,
              "Cannot delete an account that has already joined"
      end

      # delete! (not delete) so the emitted iam:accounts:deleted event carries
      # the deleting actor's identity (Account::Repository#delete! adds the
      # actor metadata; the base `delete` does not).
      accounts.delete!(id)
    end

    def mark_as_joined(token)
      accounts.transaction do
        account = accounts.find_by!({ invitation_token: token }, scope: accounts.scoped(:join))

        # account invitation expires in 3 days
        if account.invitation_expired_at.nil? || account.invitation_expired_at < Time.now
          raise Verse::Error::ValidationFailed, "Invitation has expired"
        end

        accounts.update!(
          account.id,
          { joined_at: Time.now, invitation_token: nil, invitation_expired_at: nil },
          scope: accounts.scoped(:join)
        )

        [
          accounts.find!(account.id, scope: accounts.scoped(:join)),
          update_password_reset_token(account)
        ]
      end
    end

    # Low-level resend. Runs only with a system context (like #create); the
    # guarded endpoint checks authorisation first and delegates here.
    def resend_pending_invitations(id, actor: nil)
      auth_context.can!(:update, accounts.class.resource) do |scope|
        scope.all? { true }

        scope.else? do
          raise Verse::Error::Unauthorized, "Only system can resend pending invitations"
        end
      end

      account = accounts_system.find!(id)

      unless account.joined_at.nil?
        raise Verse::Error::NotFound, "Account with email #{account.email} already joined"
      end

      unless account.enabled
        raise Verse::Error::Unauthorized, "Cannot resend invitation for a disabled account"
      end

      # Generate new invitation token and extend invitation expiry date
      invitation_token = SecureRandom.hex(32) # To invalidate previous token
      invitation_expired_at = Time.now + 3 * 24 * 60 * 60 # refresh token 3 days from now

      accounts_system.with_actor(actor) do
        accounts_system.update!(
          id,
          { invitation_token:, invitation_expired_at: }
        )
      end

      ::Service::Notification.email(
        to: account.email,
        title: "Reminder: Please join your account",
        category: "account_created",
        recipient_id: account.id,
        invitation_token:
      )
    end

    # Guarded account-level resend: authorised by the iam:accounts.invite right
    # and allowed only if the actor could invite the account with its current
    # role and scope. Then delegates to the system-context resend.
    def resend_invitation(id)
      actor_level = auth_context.can!(:invite, accounts.class.resource) do |scope|
        scope.all? { :admin }
        scope.as_org_owner? { :org_owner }
        scope.else? do
          raise Verse::Error::Unauthorized, "You do not have permission to resend this invitation"
        end
      end

      account = accounts_system.find!(id)
      actor_role = actor_level.to_s

      # user: never
      if actor_role == "user"
        raise Verse::Error::Unauthorized, "You do not have permission to resend this invitation"
      end

      # admin: any; org_owner: target ranked at most org_owner, every org in the
      # target's scope within the actor's orgs, and the target within the actor's
      # read scope (so a plain pending user in the system is not resendable).
      if actor_role == "org_owner"
        unless RoleHierarchy.can_assign_account_role?(actor_role, account.role_name)
          raise Verse::Error::Unauthorized,
                "You do not have permission to resend this invitation"
        end

        target_orgs = RoleHierarchy.normalize_orgs(account.role_scope) || []
        actor_orgs = (auth_context.custom_scopes[:org] || []).map(&:to_s)
        unless (target_orgs - actor_orgs).empty?
          raise Verse::Error::Unauthorized,
                "You do not have permission to resend this invitation"
        end

        unless accounts.scoped(:read).where(id: account.id).count > 0
          raise Verse::Error::Unauthorized,
                "You do not have permission to resend this invitation"
        end
      end

      system_service = self.class.new(Verse::Auth::Context[:system])
      system_service.resend_pending_invitations(id, actor: auth_context)
    end

    def remove_org_from_account_role_scope(organization_id, actor_metadata = nil)
      # Event-driven cascade: the write stays a plain system write; only the
      # emitted iam:accounts:updated events carry the triggering event's actor
      # (via `with_actor`). When no actor is present (e.g. a genuinely background
      # org deletion), no actor is set and the audit skips those events.
      accounts.transaction do
        accounts_system.chunked_index({ with_role_scope: { org: [organization_id.to_s] } }).each do |account|
          previous_account = account
          scope = RoleHierarchy.normalize_orgs(account.role_scope) || []
          new_scope = scope - [organization_id.to_s]

          attrs = { role_scope: { "org" => new_scope }.to_json }
          attrs[:role_name] = "user" if account.role_name == "org_owner" && new_scope.empty?

          accounts_system.with_actor(actor_metadata) do
            accounts_system.update!(account.id, attrs)
          end
          updated_account = accounts_system.find!(account.id)

          accounts.after_commit do
            role_change_notification.deliver!(previous_account:, updated_account:)
          end
        end
      end
    end

    private

    def actor_orgs
      (auth_context.custom_scopes[:org] || []).map(&:to_s)
    end

    # Whether the actor may change the role/enabled state of a target whose
    # CURRENT role is +target_current_role+. Strictly higher rank, with the
    # admin → admin allowance. Unlike can_assign_account_role?, there is NO
    # org_owner → org_owner peer allowance here — the only peer allowance is the
    # org_owner scope delta (merge_role_scope).
    def can_change_account_role?(actor_role, target_current_role)
      actor_role = actor_role.to_s
      target_current_role = target_current_role.to_s

      return true if actor_role == "admin" && target_current_role == "admin"

      RoleHierarchy.rank(actor_role) > RoleHierarchy.rank(target_current_role)
    end

    # Whether the target is within the actor's repository update scope
    # (accounts.scoped(:update)). For an org_owner this is the members of their
    # org projects; for a plain user it is self only. This correctly includes
    # plain users who are members of the actor's org projects (the old
    # "target's orgs ⊆ actor's orgs" check wrongly excluded them).
    def within_update_scope?(target)
      accounts.scoped(:update).where(id: target.id).count > 0
    end

    # Invite on an existing email — expand, never reduce.
    def invite_existing_account(existing, target_role, requested_scope, actor_role, actor_orgs)
      # Disabled accounts are never re-enabled by an invite.
      unless existing.enabled
        raise Verse::Error::Unauthorized,
              "Cannot invite a disabled account; an administrator or org owner must re-enable it"
      end

      # Anything ranked above the actor is rejected.
      unless RoleHierarchy.can_assign_account_role?(actor_role, existing.role_name)
        raise Verse::Error::Unauthorized,
              "You do not have permission to invite this account"
      end

      current_orgs = RoleHierarchy.normalize_orgs(existing.role_scope) || []

      # New role = the higher of the current and requested role (expand, never
      # reduce). An admin invited as `user` (e.g. by a project invite) stays
      # admin; an admin invited as org_owner stays admin.
      new_role =
        if RoleHierarchy.rank(existing.role_name) >= RoleHierarchy.rank(target_role)
          existing.role_name
        else
          target_role
        end

      # Only add orgs to the scope when the resulting role is org_owner. Granted
      # orgs = requested orgs ∩ actor's orgs (admin/system: requested as-is);
      # never grant all of the actor's orgs. Only NEWLY ADDED orgs must be within
      # the actor's reach (same rule as merge_role_scope): the org-owners modal
      # sends the account's existing orgs plus the new one, so existing orgs
      # outside the actor's reach are allowed.
      new_scope = current_orgs
      if new_role == "org_owner"
        requested_orgs = RoleHierarchy.normalize_orgs(requested_scope) || []

        unless %w[admin system].include?(actor_role)
          outside = (requested_orgs - current_orgs) - actor_orgs
          raise Verse::Error::Unauthorized,
                "Cannot assign an organization outside your own organizations" unless outside.empty?
        end

        granted =
          if %w[admin system].include?(actor_role)
            requested_orgs
          else
            requested_orgs & actor_orgs
          end
        new_scope = (current_orgs | granted).sort
      end

      # Never leave an org_owner with an empty org list.
      new_role = "user" if new_role == "org_owner" && new_scope.empty?

      # No change → return the account, no error, no email.
      return existing if new_role == existing.role_name && new_scope == current_orgs

      attrs = { role_name: new_role, role_scope: { "org" => new_scope }.to_json }
      accounts_system.with_actor(auth_context) do
        accounts_system.update!(existing.id, attrs)
      end
      updated_account = accounts_system.find!(existing.id)

      accounts.after_commit do
        role_change_notification.deliver!(previous_account: existing, updated_account: updated_account)
      end

      updated_account
    end

    # Builds a JSON:API record for the system-context create.
    def build_record(name:, email:, role_name:, role_scope:, enabled:)
      Verse::JsonApi::Struct.new(
        {
          type: Resource::Iam::Accounts,
          attributes: {
            name: name,
            email: email,
            role_name: role_name,
            role_scope: role_scope,
            enabled: enabled
          }.compact
        }
      )
    end

    # Normalizes the scope for a new account created via invite. Only org_owner
    # targets carry a scope; orgs are restricted to the actor's reach.
    def normalize_scope_for_create(target_role, requested_scope, actor_role, actor_orgs)
      return {} unless target_role == "org_owner"

      requested = RoleHierarchy.normalize_orgs(requested_scope) || []
      unless %w[admin system].include?(actor_role)
        outside = requested - actor_orgs
        raise Verse::Error::Unauthorized,
              "Cannot assign an organization outside your own organizations" unless outside.empty?
      end

      { "org" => requested.sort }
    end

    # Normalizes a role_scope for storage: string keys, string org ids, deduped,
    # serialized as JSON for the jsonb column.
    def normalize_scope_for_storage(role_scope)
      orgs = RoleHierarchy.normalize_orgs(role_scope) || []
      { "org" => orgs.uniq.sort }.to_json
    end

    # Demotes an org_owner whose org list is empty to user.
    def demote_org_owner_without_orgs(account)
      orgs = RoleHierarchy.normalize_orgs(account.role_scope) || []
      return account unless orgs.empty?

      accounts.update!(account.id, { role_name: "user" })
      accounts.find!(account.id)
    end

    def update_password_reset_token(account)
      password_reset_token = SecureRandom.hex(32)

      accounts.no_event do
        accounts.update!(
          account.id,
          {
            password_reset_token:,
            password_reset_token_expires_at: Time.now + 3600 # Token valid for 1 hour
          },
          scope: accounts.scoped(:join)
        )
      end

      password_reset_token
    end
  end
end
