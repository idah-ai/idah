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

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(table.db[:projects].where(organization_id: org_ids).select(1).exists)
        end

        scope.as_user? { account_project_scoped_query(action) }
      end
    end

    # Actions                      | Roles
    # read, create, update, delete | project_owner
    #
    # Info:
    # Only allowed for project_owner(member), org_owner and admin roles
    query
    def account_project_scoped_query(action)
      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
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
            roles: %w[project_owner annotator reviewer],
          )
        )
      when :create, :update, :delete
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

    query
    def account_can_access_project?(project_id, action)
      account_project_scoped_query(action).where(project_id:).limit(1).any?
    end
  end
end
