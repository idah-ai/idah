# frozen_string_literal: true

module Project
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Projects

    field :id, type: String, primary: true

    field :name, type: String
    field :description, type: String
    field :created_by_email, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

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
        scope.as_user? { account_project_scoped_query(action) }
      end
    end

    # Actions          | Roles
    # read             | project_owner, annotator, reviewer
    # update/delete    | project_owner
    # create           | N/A
    #
    # Info:
    # 1. annotators and reviewers can only read projects
    # 2. only org_owner and project_owner(member) can update and delete projects
    # 3. only org_owner and admin roles can create projects
    query
    def account_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

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
  end
end
