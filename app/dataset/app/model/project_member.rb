# frozen_string_literal: true

module ProjectMember
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::ProjectMembers

    field :id, type: Integer, primary: true
    field :project_id, type: String, readonly: true

    field :account_id, type: Integer, readonly: true
    field :name, type: [String, NilClass]
    field :email, type: String

    field :role, type: String, readonly: true

    field :invited_by_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "project_members"
    self.resource = Resource::Dataset::ProjectMembers

    custom_filter :organization_id__in do |collection, value|
      where_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM projects p
          WHERE p.organization_id IN ?
            AND p.id = project_members.project_id
        )
      SQL

      collection.where(Sequel.lit(where_fragment, value.map(&:to_i)))
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(
            table.db[:projects]
              .where(organization_id: org_ids)
              .where(id: Sequel[:project_members][:project_id])
              .select(1).exists
          )
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions                      | Roles
    # read                         | project_owner, reviewer, annotator
    # create, update, delete       | project_owner
    #
    # Info:
    # 1. project_owner can create, update and delete project members
    # 2. annotator and reviewer can only read project members in their projects
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          -- All with roles
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = project_members.project_id
            AND pm.role IN :roles
        )
      SQL

      case action
      when :read
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner reviewer annotator],
          )
        )
      when :update, :delete
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner],
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    def create(attributes)
      with_metadata do
        add_metadata(
          email: auth_context.metadata[:email],
          project_id: attributes[:project_id],
        )

        super(attributes)
      end
    end

    def update!(id, attributes)
      with_metadata do
        membership = find!(id)

        add_metadata(
          email: auth_context.metadata[:email],
          project_id: attributes[:project_id] || membership.project_id,
        )

        super(id, attributes)
      end
    end

    def delete!(id)
      with_metadata do
        membership = find!(id)

        add_metadata(
          email: auth_context.metadata[:email],
          project_id: membership.project_id,
        ) if membership

        super(id)
      end
    end
  end
end
