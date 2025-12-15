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

        scope.as_org_owner? { table.where(id: accounts_under_org_scope) } # under org scope projects

        scope.as_user? { table } # under assigned projects

        scope.self? { table.where(id: auth_context.metadata[:id]) }
      end
    end

    private def accounts_under_org_scope
      org_ids = auth_context.custom_scopes[:org]

      projects = Verse::Cache.with_cache(
        "iam/accounts/service/projects",
        "account_id:#{auth_context.metadata[:id]}",
        expires_in: 180
      ) do
        Api[:idah].dataset.projects.index(organization_id: org_ids).data
      end

      memberships = Verse::Cache.with_cache(
        "iam/accounts/service/memberships",
        "account_id:#{auth_context.metadata[:id]}",
        expires_in: 180
      ) do
        Api[:idah].dataset.project_members.index(project_id: projects.map(&:id).uniq).data
      end

      memberships.map(&:account_id).uniq
    end

    private def accounts_under_participated_projects
      account_id = auth_context.metadata[:id]

      participated_memberships = Verse::Cache.with_cache(
        "iam/accounts/service/memberships",
        "account_id:#{auth_context.metadata[:id]}",
        expires_in: 180
      ) do
        participated_projects = Api[:idah].dataset.project_members.index(account_id: account_id)
                                          .data.map(&:project_id).uniq

        Api[:idah].dataset.project_members.index(project_id: participated_projects).data
      end

      participated_memberships.map(&:account_id).uniq
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
  end
end
