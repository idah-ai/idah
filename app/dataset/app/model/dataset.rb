# frozen_string_literal: true

module Dataset
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Datasets

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true

    field :name, type: String
    field :labels, type: Array
    field :modality, type: String, readonly: true

    field :labeling_configuration, type: Hash
    field :workflow_configuration, type: Hash

    field :status, type: String, readonly: true
    field :progress, type: Float, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id

    has_many :entries, repository: "Entry::Repository", foreign_key: :dataset_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :dataset_id
    has_many :note_feeds, repository: "NoteFeed::Repository", foreign_key: :dataset_id

    def entry_workflow
      Workflow::EntryWorkflow
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "datasets"
    self.resource = Resource::Dataset::Datasets

    encoder :labeling_configuration, Verse::Sequel::JsonEncoder
    encoder :workflow_configuration, Verse::Sequel::JsonEncoder
    encoder :labels, Verse::Sequel::PgArrayEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(
            table.db[:projects]
              .where(organization_id: org_ids)
              .where(id: Sequel[:datasets][:project_id])
              .select(1).exists
          )
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions                | Roles
    # read                   | project_owner, annotator, reviewer
    # create, update, delete | project_owner
    #
    # Info:
    # 1. project_owner can create, update and delete datasets
    # 2. annotator and reviewer can only read datasets
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
              AND pm.project_id = datasets.project_id
              AND (
                -- All with roles
                pm.role IN :with_roles OR
                -- From assigned entries with roles
                (
                  pm.role IN :assigned_to_roles
                  AND EXISTS (
                    SELECT 1
                    FROM entries e
                    WHERE e.dataset_id = datasets.id
                      AND e.assigned_to_member_id = pm.id
                  )
                )
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
              AND pm.project_id = datasets.project_id
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

    def update_progress!(dataset_id)
      # Get counter values from the dataset record
      dataset = table.where(id: dataset_id).first

      return unless dataset

      total_entries = dataset[:entries_total_count]

      return if total_entries.zero?

      completed_entries = dataset[:entries_completed_count]

      progress = completed_entries.to_f / total_entries

      if completed_entries >= total_entries
        completed!(dataset_id, progress)
      else
        in_progress!(dataset_id, progress)
      end
    end

    event(name: "completed")
    def completed!(dataset_id, progress)
      no_event do
        update!(dataset_id, { progress: progress, status: "completed" })
      end
    end

    event(name: "in_progress")
    def in_progress!(dataset_id, progress)
      no_event do
        update!(dataset_id, { progress: progress, status: "in_progress" })
      end
    end
  end
end
