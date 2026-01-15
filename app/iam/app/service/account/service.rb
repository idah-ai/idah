# frozen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository,
        organization_service: Organization::Service,
        role_change_notification: Account::RoleChangeNotification

    use_system accounts_system: Account::Repository

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
  end
end
