# frozen_string_literal: true

module Auth
  class Service < Verse::Service::Base
    use_repo \
      accounts: Account::Repository,
      account_sessions: AccountSession::Repository

    use_system_repo \
      system_accounts: Account::Repository,
      system_roles: RoleRepository

    def create_refresh_token(account, role_name, nonce:, session_id: nil, ip: "", user_agent: nil)
      seq, session_id = account_sessions.bump_refresh_seq(
        account.id,
        role_name,
        session_id:,
        nonce:,
        ip:,
        user_agent:
      )

      RefreshToken.encode(
        account.id,
        session_id,
        nonce,
        seq,
        exp: Time.now.to_i + ::Settings["refresh_token.lifetime"],
      )
    end

    def login(email, password, ip: "", user_agent: nil)
      # find the account, raise error if not found
      account = accounts.login(email, password)

      # check the password, raise error if incorrect
      raise Verse::Error::Authorization, "Invalid credentials" if account.nil?

      # build the two tokens for the account
      build_tokens(account, ip:, user_agent:, nonce: 1)
    rescue Verse::Error::RecordNotFound
      raise Verse::Error::Authorization, "Invalid credentials"
    end

    # Check if the given token is valid and regenerate a new token
    def refresh_token(_auth_token, refresh_token, ip: "", user_agent: nil)
      uid, session_id, nonce = RefreshToken.validate(refresh_token)

      # find the account, raise error if not found
      account = system_accounts.find_by!({ id: uid })

      build_tokens(account, session_id: session_id, ip:, user_agent:, nonce: nonce + 1)
    rescue Verse::Error::RecordNotFound
      raise BadRefreshTokenError, "Account not found"
    end

    def delete_session(refresh_token)
      uid, session_id, _nonce = RefreshToken.validate(refresh_token)

      account_sessions.delete(session_id)
    end

    private

    # Build the tokens for the given account and role name
    # @return [String, String] the auth_token and refresh_token
    def build_tokens(account, nonce:, session_id: nil, ip: "", user_agent: nil)
      account_role = account.role
      # # If no active roles for the given account, raise error
      if account_role.nil?
        raise Verse::Error::Authorization, "No role active"
      end

      # Fetch labels from the role repository
      role = system_roles.find_by({ name: account_role })

      unless role
        raise Verse::Error::ValidationFailed, "Cannot find role #{account_role}"
      end

      exp = Time.now.to_i + ::Settings["auth_token.lifetime"]

      # encode the auth_token
      auth_token = Verse::Http::Auth::Token.encode(
        {
          id: account.id,
          email: account.email,
        }.compact,
        account_role,
        {}, # no role scopes for now role.scopes
        exp:
      )

      # generate a refresh token
      refresh_token = create_refresh_token(account, account_role, session_id:, ip:, nonce:, user_agent:)

      AccountAuth::Record.new(
        {
          id: account.id,
          email: account.email,
          name: account.name,
          picture_url: account.picture_url,
          role_name: role.name,
          role_labels: role.labels,
          scope: {},
          role_rights: role.rights,
          # auth_type: account.auth_type,
          user_agent:,
          auth_token:,
          refresh_token:,
          exp:
        }
      )
    end
  end
end
