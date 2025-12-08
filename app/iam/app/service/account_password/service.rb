# frozen_string_literal: true

module AccountPassword
  class Service < Verse::Service::Base
    use accounts: Account::Repository
    use_system account_repo: Account::Repository

    def request_password_reset(email)
      account = account_repo.find_by({ email: })

      return unless account

      # Save the token to the database
      password_reset_token = update_password_reset_token(account)

      # Send the password reset email
      ::Service::Notification.email(
        recipient_account_email: account.email,
        title: "Reset Password",
        category: "password_reset",
        password_reset_token:,
      )
    end

    def reset_password(token, new_password)
      account = account_repo.find_by({ password_reset_token: token })

      raise Verse::Error::NotFound, "Invalid password reset token" unless account

      if account_token_expired?(account)
        raise Verse::Error::ValidationFailed, "Password reset token expired"
      end

      account_repo.no_event do
        account_repo.update!(
          account.id,
          {
            hashed_password: BCrypt::Password.create(new_password),
            password_reset_token: nil,
            password_reset_token_expires_at: nil
          }
        )
      end
    end

    def token_valid?(token)
      account = account_repo.find_by({ password_reset_token: token })

      return false unless account

      return false if account_token_expired?(account)

      true
    end

    def change_password(id, old_password, new_password)
      accounts.transaction do
        account = accounts.find!(id)

        unless account.password_match?(old_password)
          raise Verse::Error::ValidationFailed, "Old password is incorrect"
        end

        account_repo.update!(
          id,
          { hashed_password: BCrypt::Password.create(new_password) }
        )
      end
    end

    private

    def update_password_reset_token(account)
      password_reset_token = SecureRandom.hex(32)

      account_repo.no_event do
        account_repo.update!(
          account.id,
          {
            password_reset_token:,
            password_reset_token_expires_at: Time.now + 3600 # Token valid for 1 hour
          }
        )
      end

      password_reset_token
    end

    def account_token_expired?(account)
      account.password_reset_token_expires_at.nil? || account.password_reset_token_expires_at <= Time.now
    end
  end
end
