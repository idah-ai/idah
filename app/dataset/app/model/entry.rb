# frozen_string_literal: true

module Entry
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Entries

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true
    field :dataset_id, type: String, readonly: true

    field :priority, type: Integer

    field :wf_step, type: String # , readonly: true
    field :status, type: String # , readonly: true

    field :job_id, type: Integer

    field :resource, type: String

    # Add through assign method
    field :assigned_to_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id

    has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entries"
    self.resource = Resource::Dataset::Entries

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(table.db[:projects].where(organization_id: org_ids).select(1).exists)
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions                | Roles
    # read                   | project_owner, annotator(assigned), reviewer(assigned)
    # create, update, delete | project_owner
    #
    # Info:
    # 1. only org_owner and project_owner(member) can create, update and delete entries
    # 2. annotator and reviewer can only read entries assigned to them
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]

      case action
      when :read
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = entries.project_id
              AND pm.role IN :with_roles
          ) OR (
            entries.assigned_to_id = :account_id
            AND EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.account_id = :account_id
                AND pm.project_id = entries.project_id
                AND pm.role IN :assigned_to_roles
            )
          )
        SQL

        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            with_roles: %w[project_owner],
            assigned_to_roles: %w[annotator reviewer]
          )
        )
      when :update, :delete
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = entries.project_id
              AND pm.role IN :roles
          )
        SQL

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

    def mark_entries_status_as(job_id, status)
      entry = find_by!({ job_id: job_id, status: "processing" })

      transaction do
        update!(entry.id, { status: status })
      end
    end
  end
end
