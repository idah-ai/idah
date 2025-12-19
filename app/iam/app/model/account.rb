# frozen_string_literal: true

module Account
  class Record < Verse::Model::Record::Base
    type Resource::Iam::Accounts

    field :id, type: Integer, primary: true

    field :name, type: String
    field :email, type: String, readonly: true

    field :hashed_password, type: [String, NilClass], visible: false, readonly: true
    field :password_reset_token, type: [String, NilClass], visible: false, readonly: true
    field :password_reset_token_expires_at, type: [Time, NilClass], visible: false, readonly: true

    field :sso_channel, type: [String, NilClass], readonly: true

    field :enabled, type: [TrueClass]
    field :role_name, type: [String, NilClass]
    field :role_scope, type: Hash

    field :picture_url, type: [String, NilClass], readonly: true

    field :joined_at, type: [Time, NilClass], readonly: true
    field :invitation_expired_at, type: [Time, NilClass], readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    def password_match?(password)
      return false unless hashed_password

      BCrypt::Password.new(hashed_password) == password
    end
  end

  # TODO: scope for account creation might neede to be created and checked for different creator's account role
  class Repository < Verse::Sequel::Repository
    self.table = "accounts"
    self.resource = Resource::Iam::Accounts

    custom_filter :role_name__nin do |collection, role_name|
      collection.where(Sequel.lit("role_name NOT IN ?", role_name))
    end

    custom_filter :with_role_scope do |collection, role_scope|
      role_scope = role_scope.to_json unless role_scope.is_a?(String)

      collection.where(Sequel.lit("role_scope @> ?", role_scope))
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? { accounts_from_project_member_scoped }

        scope.own { table.where(id: auth_context.metadata[:id]) }
      end
    end

    def login(email, password)
      account = scoped(:login).where(email:).first

      # To prevent timing attack, add small delay when account is not found.
      if account
        account = decode(account)
        account = self.class.model_class.new(account)
        valid = account.password_match?(password)
      else
        sleep(rand(0.3..0.5))
        valid = false
      end

      valid ? account : nil
    end

   private def accounts_from_project_member_scoped
      account_id = auth_context.metadata[:id]
      org_ids = auth_context[:org] || []

      membership_account_ids =
        if org_ids.any?
          Api[:idah].dataset.project_members.index(
            filter: { organization_id__in: org_ids }
          ).data.map(&:account_id).uniq
        else
          []
        end

      account_ids = [account_id] + membership_account_ids

      table.where(id: account_ids)
    end

    def create(attributes)
      with_metadata do
        add_metadata(
          email: auth_context.metadata[:email],
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        add_metadata(
          email: auth_context.metadata[:email],
        )

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        account = find!(id)

        add_metadata(
          email: auth_context.metadata[:email],
        ) if account

        super(id)
      end
    end
  end
end
