# frozen_string_literal: true

module Auth
  class Service < Verse::Service::Base
    AUTH_TOKEN_LIFETIME = 86_400 # 1 day
    REFRESH_TOKEN_LIFETIME = 1_209_600 # 14 days

    use_repo \
      accounts: Account::Repository,
      account_sessions: AccountSession::Repository

    use_system_repo \
      system_accounts: Account::Repository,
      system_account_sessions: AccountSession::Repository,
      system_roles: RoleRepository,
      system_api_keys: ApiKey::Repository

    def create_refresh_token(account, nonce:, session_id: nil, ip: "", user_agent: nil)
      seq, session_id = account_sessions.bump_refresh_seq(
        account,
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
        exp: Time.now.to_i + REFRESH_TOKEN_LIFETIME,
      )
    end

    def login(email, password, ip: "", user_agent: nil)
      # find the account, raise error if not found
      account = accounts.login(email, password)

      # check the password, raise error if incorrect
      raise Verse::Error::Authorization, "invalid_credentials" if account.nil?
      raise Verse::Error::Authorization, "account_disabled" unless account.enabled

      # build the two tokens for the account
      build_tokens(account, ip:, user_agent:, nonce: 1)
    rescue Verse::Error::RecordNotFound
      raise Verse::Error::Authorization, "invalid_credentials"
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

    def logout(refresh_token)
      _uid, session_id, _nonce = RefreshToken.validate(refresh_token)

      system_account_sessions.logout(session_id)
    end

    def login_api(key, token_expiration: 3600)
      now = Time.now

      unless key.start_with?("IDAH_") && key.size == 69
        raise Verse::Error::Authorization, "Invalid Key"
      end

      key_sha = Digest::SHA256.hexdigest(key)

      api_key = system_api_keys.find_by(
        { key_sha: },
        included: ["service_account"]
      )

      unless api_key
        raise Verse::Error::Authorization, "Invalid credentials"
      end

      unless api_key.valid_key?
        raise Verse::Error::Authorization, "API key has been revoked or expired"
      end

      unless api_key.status == "active"
        raise Verse::Error::Authorization, "API key is not active (status: #{api_key.status})"
      end

      account = api_key.service_account

      scope = api_key.build_scope

      # Generate the compound role from permissions
      role = "api:#{api_key.permissions.join(",")}"

      exp = now.to_i + token_expiration

      # Encode the auth token with api label
      auth_token = Verse::Http::Auth::Token.encode(
        {
          id: account.id,
          email: account.email,
          name: account.name,
          labels: ["api"]
        }.compact,
        role,
        scope,
        exp:
      )

      # Update the API key last used timestamp
      system_api_keys.update!(api_key.id, { last_used_at: now })

      # Get role rights from API permissions
      role_rights = api_role_rights(api_key.permissions)

      AccountAuth::Record.new(
        {
          id: account.id,
          email: account.email,
          name: account.name,
          picture_url: account.picture_url,
          role_name: role,
          role_scope: scope,
          role_rights:,
          auth_token:,
          exp:
        }
      )
    end

    private

    def api_role_rights(permissions)
      rights = []
      api_roles = permissions.map { |x| "api/#{x}" }

      system_roles.chunked_index({ name__in: api_roles }).each do |role|
        rights += role.rights
      end

      rights
    end

    # Build the tokens for the given account and role name
    # @return [String, String] the auth_token and refresh_token
    def build_tokens(account, nonce:, session_id: nil, ip: "", user_agent: nil)
      account_role = account.role_name

      # Fetch labels from the role repository
      role = system_roles.find_by({ name: account_role })

      unless role
        raise Verse::Error::ValidationFailed, "Cannot find role #{account_role}"
      end

      exp = Time.now.to_i + AUTH_TOKEN_LIFETIME

      # encode the auth_token
      auth_token = Verse::Http::Auth::Token.encode(
        {
          id: account.id,
          email: account.email,
          name: account.name,
        }.compact,
        account_role,
        account.role_scope,
        exp:
      )

      refresh_token = unless account_role == "system"
                        create_refresh_token(
                          account,
                          session_id:,
                          ip:,
                          nonce:,
                          user_agent:
                        )
                      end

      AccountAuth::Record.new(
        {
          id: account.id,
          email: account.email,
          name: account.name,
          picture_url: account.picture_url,
          role_name: role.name,
          scopes: account.role_scope,
          role_rights: role.rights,
          auth_token:,
          refresh_token:,
          exp:
        }
      )
    end
  end
end
