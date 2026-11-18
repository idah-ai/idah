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
    include ActorEventMetadata

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

        scope.as_org_owner? do
          if action == :read
            # Read union: self ∪ enabled members of the actor's org projects ∪
            # co-members of projects where the actor is an enabled member.
            accounts_from_org_and_membership_scoped
          else
            # Updates stay limited to accounts reachable through the actor's own
            # orgs (foreign memberships never widen update scope).
            accounts_from_project_member_scoped
          end
        end

        scope.as_user? { accounts_from_own_memberships_scoped }

        scope.own? { table.where(id: auth_context.metadata[:id]) }
      end
    end

    event(name: "logged_in")
    def login(email, password)
      account = scoped(:login).where(email:).first

      # To prevent timing attack, add small delay when account is not found.
      if account
        account = decode(account)
        account = self.class.model_class.new(account)
        valid = account.password_match?(password)

        add_metadata(
          actor_account_id: account.id,
          actor_account_email: account.email,
          actor_account_role_name: account.role_name,
          validation: valid
        )
      else
        sleep(rand(0.3..0.5))
        valid = false
      end

      valid ? account : nil
    end

    def delete!(id)
      with_metadata do
        find!(id)

        super(id)
      end
    end

    private

    def accounts_from_project_member_scoped
      account_id = auth_context.metadata[:id]
      org_ids = auth_context[:org] || []

      membership_account_ids =
        if org_ids.any?
          ProjectMembership::Lookup.new.member_account_ids(organization_ids: org_ids)
        else
          []
        end

      account_ids = [account_id] + membership_account_ids

      table.where(id: account_ids)
    end

    # as_org_owner read union: self ∪ enabled members of the actor's org projects
    # ∪ co-members of projects where the actor is an enabled member.
    def accounts_from_org_and_membership_scoped
      account_id = auth_context.metadata[:id]
      org_ids = auth_context[:org] || []

      lookup = ProjectMembership::Lookup.new

      account_ids = [account_id]

      if org_ids.any?
        account_ids += lookup.member_account_ids(organization_ids: org_ids)
      end

      # Co-members of the actor's own memberships (foreign projects included).
      project_ids = lookup.memberships_for(account_id).map(&:project_id)
      if project_ids.any?
        account_ids += lookup.member_account_ids(project_ids:)
      end

      table.where(id: account_ids.uniq)
    end

    # as_user read scope: self ∪ co-members of projects where the actor is an
    # enabled member. Resolved through ProjectMembership::Lookup.
    def accounts_from_own_memberships_scoped
      account_id = auth_context.metadata[:id]

      # The actor's enabled memberships → the projects they belong to.
      project_ids = ProjectMembership::Lookup.new.memberships_for(account_id).map(&:project_id)

      membership_account_ids =
        if project_ids.any?
          ProjectMembership::Lookup.new.member_account_ids(project_ids:)
        else
          []
        end

      account_ids = ([account_id] + membership_account_ids).uniq

      table.where(id: account_ids)
    end
  end
end
