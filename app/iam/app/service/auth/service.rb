# frozen_string_literal: true

module Auth
  class Service < Verse::Service::Base
    use_repo \
      accounts: Account::Repository
    use_system_repo \
      system_accounts: Account::Repository,
      system_roles: RoleRepository

    def create_refresh_token(account, role_name, nonce:, ip: "")
      seq = account_states.bump_refresh_seq(account.id, role_name, ip:, nonce:)

      RefreshToken.encode(
        account.id,
        nonce,
        seq,
        exp: Time.now.to_i + Settings["refresh_token.lifetime"],
      )
    end

    def login(email, password, role: nil, ip: "")
      # find the account, raise error if not found
      account = accounts.login(email, password)

      # check the password, raise error if incorrect
      raise Verse::Error::Authorization, "Invalid credentials" if account.nil?

      # ou = account.person&.organizational_unit
      # raise Verse::Error::Authorization, "Unauthorized Access" if ou && !ou_service.authorized_host?(ou, ip)

      # build the two tokens for the account
      build_tokens(account, role, ip:, nonce: SecureRandom.random_number(2 ** 63))
    rescue Verse::Error::RecordNotFound
      raise Verse::Error::Authorization, "Invalid credentials"
    end

    private

    # Build the tokens for the given account and role name
    # @return [String, String] the auth_token and refresh_token
    def build_tokens(account, role_name, nonce:, ip: "")
      account_role = account.role
      # # If no active roles for the given account, raise error
      if account_role.nil?
        raise Verse::Error::Authorization, "No role active"
      end

      # Fetch labels from the role repository
      role = system_roles.find_by({ name: role_name })

      unless role
        raise Verse::Error::ValidationFailed, "Cannot find role #{role_name}"
      end

      exp = Time.now.to_i + Settings["auth_token.lifetime"]


      # encode the auth_token
      auth_token = Verse::Http::Auth::Token.encode(
        {
          id: account.id,
          email: account.email,
          # labels: role.labels
        }.compact,
        role_name,
        role.scopes,
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
          scope: role.scopes,
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
