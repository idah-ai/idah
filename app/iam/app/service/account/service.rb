# frozen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository,
        organization_service: Organization::Service

    use_system accounts_system: Account::Repository,
               organization_repo_system: Organization::Repository

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
      if record.attributes[:role_name] == ("system" || "admin") &&
         auth_context.can?(:create, projects.class.resource) != :all

        raise Verse::Error::ValidationFailed, "System account can't be created"
      end

      accounts.transaction do
        attr = record.attributes.dup

        # We use the system repository to check for existing accounts
        account = accounts_system.find_by({ email: attr[:email] })

        # If account with the email already exists, return it
        if account
          auth_context.mark_as_checked!
          return account
        end

        # Set a default random password for the account if none is provided
        password = attr.delete(:password) || SecureRandom.hex(16)

        attr.merge!(
          hashed_password: BCrypt::Password.create(password),
          invitation_expired_at: Time.now + 3 * 24 * 60 * 60
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
          recipient_id: created_account.id
        )

        created_account
      end
    end

    def update(record)
      auth_context.reject! unless auth_context.can?(:update, accounts.class.resource)

      accounts.transaction do
        previous_account = accounts.find!(record.id)

        # Ensure role_scope is stored as JSON
        role_scope = record.attributes[:role_scope]
        record.attributes[:role_scope] = role_scope.to_json if role_scope&.any?

        accounts.update!(record.id, record.attributes)
        updated_account = accounts.find!(record.id)

        accounts.after_commit do
          notify_role_change(previous_account, updated_account)
        end

        updated_account
      end
    end

    def delete(id)
      accounts.delete(id)
    end

    def mark_as_joined(id)
      accounts.transaction do
        account = accounts.find!(id, scope: accounts.scoped(:join))

        # account invitation expires in 3 days
        if account.invitation_expired_at.nil? || account.invitation_expired_at < Time.now
          raise Verse::Error::ValidationFailed, "Invitation has expired"
        end

        accounts.update!(id, { joined_at: Time.now, invitation_expired_at: nil }, scope: accounts.scoped(:join))

        [
          accounts.find!(id, scope: accounts.scoped(:join)),
          update_password_reset_token(account)
        ]
      end
    end

    def resend_pending_invitations(id)
      account = accounts.find!(id)

      unless account.joined_at.nil?
        raise Verse::Error::NotFound, "Account with email #{account.email} already joined"
      end

      accounts.update!(
        id,
        { invitation_expired_at: Time.now + 3 * 24 * 60 * 60 }
      )

      ::Service::Notification.email(
        to: account.email,
        title: "Reminder: Please join your account",
        category: "account_created",
        recipient_id: account.id
      )
    end

    private

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

    def notify_role_change(previous_account, updated_account)
      # email is not needed if the role doesn't change or org_owner's scope doesn't change
      return unless role_or_org_scope_changed?(previous_account, updated_account)

      RoleChangeNotification.new(
        from_role: previous_account.role_name,
        to_role: updated_account.role_name,
        recipient_email: previous_account.email,
        recipient_id: previous_account.id,
        email_params: build_email_params(previous_account, updated_account)
      ).deliver!
    end

    def role_or_org_scope_changed?(previous_account, updated_account)
      # role is changed
      return true if previous_account.role_name != updated_account.role_name
      # role is not changed, and the account is not org_owner, so assume no org scope is changed
      return false unless previous_account.role_name == "org_owner"

      # whether org scope is changed
      previous_account.role_scope["org"] != updated_account.role_scope["org"]
    end

    def build_email_params(previous_account, updated_account)
      {
        recipient_name: previous_account.name,
        admin_name: accounts_system.find!(auth_context.metadata[:id]).name,
        **org_owner_params(previous_account, updated_account)
      }.compact
    end

    def org_owner_params(previous_account, updated_account)
      old_role = previous_account.role_name
      new_role = updated_account.role_name

      return {} unless new_role == "org_owner"

      org_id, scope_change = identify_org_scope_change(previous_account, updated_account, old_role, new_role)
      organization = organization_service.show(org_id)

      {
        organization_scope_change: scope_change,
        organization_id: organization.id,
        organization_name: organization.name
      }
    end

    # note: this checks only a single org scope change,
    # need proper check implementation for multiple org scopes change from an update
    # also email notification for this should be review to cope with multiple orgs
    def identify_org_scope_change(previous_account, updated_account, old_role, new_role)
      previous_orgs = previous_account.role_scope["org"] || []
      updated_orgs = updated_account.role_scope["org"] || []

      # role changed to be org_owner, an org scope is added
      return [updated_orgs.first, "added"] if old_role != new_role

      # org scope changed within org_owner role
      added = updated_orgs - previous_orgs
      removed = previous_orgs - updated_orgs

      return [added.first, "added"] if added.any?
      return [removed.first, "removed"] if removed.any?

      # neutral case should already be skipped
      [nil, nil]
    end
  end
end
