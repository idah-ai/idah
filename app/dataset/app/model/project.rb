# frozen_string_literal: true

module Project
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Projects

    field :id, type: String, primary: true

    field :name, type: String
    field :description, type: [String, NilClass]
    field :created_by_email, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    field :organization_id, type: Integer

    has_many :project_members, repository: "ProjectMember::Repository", foreign_key: :project_id
    has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :project_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :project_id
    has_many :note_feeds, repository: "NoteFeed::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_org_owner? {
          org_ids = auth_context.custom_scopes[:org]
          table.where(organization_id: org_ids)
        }
        scope.as_user? { account_project_scoped_query(action) }
      end
    end

    # Actions          | Roles
    # read             | project_owner, annotator, reviewer
    # update/delete    | project_owner
    # create           | N/A
    #
    # Info:
    # Annotators and reviewers can only read projects
    # Only project_owner(member), org_owner and admin roles can update and delete projects
    # Only org_owner and admin roles can create projects
    query
    def account_project_scoped_query(action)
      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = projects.id
            AND pm.role IN :roles
        )
      SQL

      case action
      when :read
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner annotator reviewer]
          )
        )
      when :update, :delete
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner]
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
