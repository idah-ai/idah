# frozen_string_literal: true

module ApiKey
  class Record < Verse::Model::Record::Base
    type Resource::Iam::ApiKeys

    field :id, type: String, primary: true

    field :account_id, type: Integer, readonly: true

    field :name, type: String
    field :key_label, type: String, readonly: true
    field :key_sha, type: String, readonly: true, visible: false

    field :permissions, type: Array

    field :scope_type, type: String
    field :scope_value, type: Array

    field :expires_at, type: [Time, NilClass]
    field :revoked_at, type: [Time, NilClass]

    field :status, type: String

    field :last_used_at, type: [Time, NilClass], readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    field :key, type: String, visible: true

    belongs_to :service_account, repository: "Account::Repository", foreign_key: :account_id

    def expired?
      return false if expires_at.nil?

      expires_at < Time.now
    end

    def revoked?
      !revoked_at.nil?
    end

    def valid_key?
      !expired? && !revoked?
    end

    # Build the scope hash based on scope_type and scope_value
    def build_scope
      case scope_type
      when "all"
        {}
      when "org"
        { org: scope_value.map(&:to_s) }
      when "project"
        { project: scope_value.map(&:to_s) }
      else
        {}
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "api_keys"
    self.resource = Resource::Iam::ApiKeys

    encoder :permissions, Verse::Sequel::PgArrayEncoder
    encoder :scope_value, Verse::Sequel::PgArrayEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? { projects_from_organization_scoped }

        scope.array? { |_x|
          auth_context.reject("only for create") unless action == :create
          true # no table scope for create action.
        }
      end
    end

    def create(attributes)
      with_metadata do
        add_event_metadata

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        add_event_metadata

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        find!(id)

        add_event_metadata

        super(id)
      end
    end

    private

    def add_event_metadata(**opts)
      add_metadata(
        actor_account_id: auth_context.metadata[:id],
        actor_account_email: auth_context.metadata[:email],
        actor_account_role_name: auth_context.metadata[:role],
        **opts
      )
    end

    def projects_from_organization_scoped
      organization_id = auth_context.custom_scopes[:org]&.first
      return table.where(Sequel.lit("false")) unless organization_id

      projects = Api[:idah].dataset.projects.index(filter: { organization_id: }).data

      # Use <@ (contained by) operator to ensure ALL scope_values are within the
      # user's own org projects/orgs — excludes API keys referencing projects or orgs
      # outside the user's organization, preventing cross-org visibility.
      table.where(
        Sequel.lit(
          "(scope_type = 'project' AND scope_value <@ ?) OR (scope_type = 'org' AND scope_value <@ ?)",
          Sequel.pg_array(projects.map(&:id)),
          Sequel.pg_array([organization_id])
        )
      )
    end
  end
end
