# frozen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository,
        organization_service: Organization::Service,
        role_change_notification: Account::RoleChangeNotification

    use_system accounts_system: Account::Repository, role_system: RoleRepository

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

    def create(record)
      guard_role_assignment!(
        record.attributes[:role_name],
        record.attributes[:role_scope]
      )

      accounts.transaction do
        attr = record.attributes.dup

        # We use the system repository to check for existing accounts, so the
        # same email can't be created twice across the whole platform.
        account = accounts_system.find_by({ email: attr[:email] })

        # When the email already belongs to an account, return only what the
        # invite flow needs to add the person (id, name, email). The caller may
        # not be allowed to see that account, so its role, scope and status are
        # never disclosed through this lookup.
        if account
          auth_context.mark_as_checked!
          return Account::Record.new(
            {
              id: account.id,
              name: account.name,
              email: account.email
            }
          )
        end

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

        id = accounts.create(attr)

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

    def update(record)
      auth_context.reject! unless auth_context.can?(:update, accounts.class.resource)

      # When the organization scope is changing, only the organizations being
      # added or removed need to be within the caller's scope, so the guard
      # needs the account's current scope. Read it only for a real caller that
      # is actually changing the scope, to keep the other paths cheap.
      previous_scope =
        if auth_context.role && !record.attributes[:role_scope].nil?
          accounts.find!(record.id).role_scope
        end

      guard_role_assignment!(
        record.attributes[:role_name],
        record.attributes[:role_scope],
        previous_scope: previous_scope
      )

      accounts.transaction do
        previous_account = accounts.find!(record.id)

        # Ensure role_scope is stored as JSON
        role_scope = record.attributes[:role_scope]
        record.attributes[:role_scope] = role_scope.to_json if role_scope&.any?

        accounts.update!(record.id, record.attributes)
        updated_account = accounts.find!(record.id)

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

      accounts.delete(id)
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

    def resend_pending_invitations(id)
      account = accounts.find!(id)

      unless account.joined_at.nil?
        raise Verse::Error::NotFound, "Account with email #{account.email} already joined"
      end

      # Generate new invitation token and extend invitation expiry date
      invitation_token = SecureRandom.hex(32) # To invalidate previous token
      invitation_expired_at = Time.now + 3 * 24 * 60 * 60 # refresh token 3 days from now

      accounts.update!(
        id,
        { invitation_token:, invitation_expired_at: }
      )

      ::Service::Notification.email(
        to: account.email,
        title: "Reminder: Please join your account",
        category: "account_created",
        recipient_id: account.id,
        invitation_token:
      )
    end

    def remove_org_from_account_role_scope(organization_id)
      accounts.transaction do
        accounts_system.chunked_index({ with_role_scope: { org: [organization_id.to_s] } }).each do |account|
          account.role_scope["org"] = account.role_scope["org"] - [organization_id.to_s]
          accounts.update!(account.id, { role_scope: account.role_scope })
        end
      end
    end

    private

    # Prevent privilege escalation when assigning a role to an account.
    #
    # A caller may only assign a role whose privilege tier (the major number of
    # its mask) is at most their own, and may only scope that role to
    # organizations they already belong to. Roles flagged as non-assignable
    # (e.g. `system`) can never be assigned through the API.
    #
    # Callers with no role (internal / system contexts built in-process) are
    # trusted and skip the ceiling; every request authenticated over HTTP
    # carries a role, so this only exempts code running inside the services.
    def guard_role_assignment!(role_name, role_scope, previous_scope: nil)
      caller_role = auth_context.role
      return if caller_role.nil?

      check_role_tier!(role_name, caller_role) unless role_name.nil?
      check_role_scope!(role_scope, previous_scope) unless role_scope.nil?
    end

    def check_role_tier!(role_name, caller_role)
      target_role = role_lookup(role_name)
      unless target_role&.assignable
        raise Verse::Error::Unauthorized,
              "Role '#{role_name}' cannot be assigned"
      end

      caller_tier =
        if caller_role.to_s.start_with?("api:")
          # API keys carry a compound "api:..." role. Cap them at the `user`
          # tier: a key may invite regular users but never create privileged
          # accounts, regardless of the key's own data rights.
          role_tier("user")
        else
          role_tier(caller_role)
        end

      return unless role_tier(role_name) > caller_tier

      raise Verse::Error::Unauthorized,
            "You are not allowed to assign the '#{role_name}' role"
    end

    # Only the organizations being added or removed need to be within the
    # caller's own scope; organizations that were already present and stay are
    # left untouched. So an org owner can add their organization to an account
    # that already owns others (scope becomes the union) without needing rights
    # over those others, but still cannot grant or remove an organization they
    # do not own.
    def check_role_scope!(role_scope, previous_scope)
      allowed_orgs = auth_context.custom_scopes[:org]
      return if allowed_orgs.nil? || allowed_orgs.empty?

      requested = requested_org_scope(role_scope)
      previous = requested_org_scope(previous_scope)
      changed = (requested - previous) | (previous - requested)

      return if (changed - allowed_orgs.map(&:to_s)).empty?

      raise Verse::Error::Unauthorized,
            "role_scope is outside your organization"
    end

    def role_lookup(name)
      role_system.find_by({ name: name.to_s })
    end

    # Privilege tier = the major number of the role mask ("8.0.0" -> 8).
    # An unknown role yields 0, the lowest tier.
    def role_tier(name)
      role_lookup(name)&.mask.to_s.split(".").first.to_i
    end

    def requested_org_scope(role_scope)
      scope = role_scope
      scope = JSON.parse(scope) if scope.is_a?(String) && !scope.strip.empty?
      # role_scope read from the database is a Sequel JSONB wrapper, not a plain
      # Hash, so coerce any hash-like value before inspecting it.
      scope = scope.to_h if scope.respond_to?(:to_h) && !scope.is_a?(Array)
      return [] unless scope.is_a?(Hash)

      Array(scope["org"] || scope[:org]).map(&:to_s)
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
