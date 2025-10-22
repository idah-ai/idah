# frozen_string_literal: true

module Auth
  class Service < Verse::Service::Base
    use_repo \
      accounts: Account::Repository,
      account_states: AccountState::Repository

    use_system_repo \
      system_accounts: Account::Repository,
      system_roles: RoleRepository

    def create_refresh_token(account, role_name, nonce:, ip: "")
      seq = account_states.bump_refresh_seq(account.id, role_name, ip:, nonce:)

      RefreshToken.encode(
        account.id,
        nonce,
        seq,
        exp: Time.now.to_i + ::Settings["refresh_token.lifetime"],
      )
    end

    def login(email, password, role: nil, ip: "")
      # find the account, raise error if not found
      account = accounts.login(email, password)

      # check the password, raise error if incorrect
      raise Verse::Error::Authorization, "Invalid credentials" if account.nil?

      # build the two tokens for the account
      build_tokens(account, role, ip:, nonce: SecureRandom.random_number(2 ** 63))
    rescue Verse::Error::RecordNotFound
      raise Verse::Error::Authorization, "Invalid credentials"
    end

        # Check if the given token is valid and regenerate a new token
    def refresh_token(auth_token, refresh_token, role: nil, ip: "")
      uid, nonce = RefreshToken.validate(refresh_token)

      # find the account, raise error if not found
      account = system_accounts.find_by!({ id: uid })

      if auth_token
        auth = Verse::Http::Auth::Token.decode(auth_token, validate: false)

        now = Time.now.to_i

        # Check if role is the same as the one in the token
        # and the active scopes are the same as the ones in the token
        # and the token is not expired, we can reuse it
        # expiration: 5 minutes

        if auth.context.role == role && auth.exp > now + (60 * 5)
          # Return existing tokens:
          return reuse_token(auth_token, refresh_token, account, role)
        end
      end

      # build the two tokens for the account
      build_tokens(account, role, ip:, nonce: )
    rescue Verse::Error::RecordNotFound
      raise BadRefreshTokenError, "Account not found"
    end


    private

    # Return the account record with the given tokens, do not
    # attempt to generate new tokens or advance in bump seq for the refresh token.
    def reuse_token(auth_token, refresh_token, account, _role_name)
      tok = Verse::Http::Auth::Token.decode(auth_token)

      role = system_roles.find_by({ name: tok.context.role })

      AccountAuth::Record.new(
        {
          id: account.id,
          email: account.email,
          name: account.name,
          picture_url: account.picture_url,
          role_name: role.name,
          role_labels: role.labels,
          scope: tok.context.custom_scopes,
          role_rights: role.rights,
          # auth_type: account.auth_type,
          auth_token:,
          refresh_token:,
          exp: tok.exp
        }
      )
    end


    # Build the tokens for the given account and role name
    # @return [String, String] the auth_token and refresh_token
    def build_tokens(account, role_name, nonce:, ip: "")
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
          # labels: role.labels
        }.compact,
        account_role,
        {}, # no role scopes for now role.scopes
        exp:
      )

      # generate a refresh token
      refresh_token = create_refresh_token(account, role_name, ip:, nonce:)

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
          auth_token:,
          refresh_token:,
          exp:
        }
      )
    end
  end
end
