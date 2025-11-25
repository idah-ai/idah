# frozen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository

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
      accounts.transaction do
        record_id = accounts.create(record.attributes)
        created_account = accounts.find!(record_id)

        # Send the join invitation email
        ::Service::Notification.email(
          recipient_account_email: created_account.email,
          title: "Account Created",
          category: "account_created",
        )

        created_account
      end
    end

    def update(record)
      accounts.update!(record.id, record.attributes)
      accounts.find!(record.id)
    end

    def delete(id)
      accounts.delete(id)
    end

    def mark_as_joined(id)
      accounts.transaction do
        account = accounts.find!(id)

        # account invitation expires in 3 days
        if account.invitation_expired_at < Time.now
          raise Verse::Error::ValidationFailed, "Invitation has expired"
        end

        [
          accounts.update!(id, { joined_at: Time.now, invitation_expired_at: nil }),
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
        recipient_account_email: account.email,
        title: "Reminder: Please join your account",
        category: "account_created"
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
          }
        )
      end

      password_reset_token
    end
  end
end
