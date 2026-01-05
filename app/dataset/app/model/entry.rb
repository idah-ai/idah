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

    field :job_id, type: String

    field :resource, type: String

    field :assigned_to_id, type: [Integer, NilClass] # Add through assign method
    field :submitted_by_id, type: [Integer, NilClass] # Add through submit method
    field :reviewed_by_id, type: [Integer, NilClass] # Add through review method

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id

    has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entries"
    self.resource = Resource::Dataset::Entries

    custom_filter :participated do |collection, value|
      where_fragment = <<-SQL
        assigned_to_id = :account_id
        OR submitted_by_id = :account_id
        OR reviewed_by_id = :account_id
      SQL

      collection.where(Sequel.lit(where_fragment, account_id: value))
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(
            table.db[:projects]
              .where(organization_id: org_ids)
              .where(id: Sequel[:entries][:project_id])
              .select(1).exists
          )
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions                | Roles
    # read                   | project_owner, annotator(assigned), reviewer(assigned)
    # create, update, delete | project_owner
    #
    # Info:
    # 1. project_owner can create, update and delete entries
    # 2. annotator and reviewer can only read entries assigned to them
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]

      case action
      when :read, :submit
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = entries.project_id
              AND (
                -- All with roles
                pm.role IN :with_roles OR
                -- Annotators can access only assigned entries
                (
                  (pm.role IN :annotator_roles)
                  AND entries.assigned_to_id = :account_id
                ) OR
                -- Reviewers can access assigned and unassigned entries not submitted by themselves in review step
                (
                  (pm.role IN :reviewer_roles)
                  AND (
                    entries.assigned_to_id = :account_id OR
                    (
                      entries.wf_step = 'review' AND
                      entries.assigned_to_id IS NULL AND
                      entries.submitted_by_id != :account_id
                    )
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
            annotator_roles: %w[annotator],
            reviewer_roles: %w[reviewer]
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

    def create(attributes)
      with_metadata do
        add_metadata(
          actor_account_id: auth_context.metadata[:id],
          actor_account_email: auth_context.metadata[:email],
          project_id: attributes[:project_id],
          dataset_id: attributes[:dataset_id]
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        entry = find!(id)

        if entry
          add_metadata(
            actor_account_id: auth_context.metadata[:id],
            actor_account_email: auth_context.metadata[:email],
            project_id: attributes[:project_id] || entry.project_id,
            dataset_id: attributes[:dataset_id] || entry.dataset_id,
            entry_id: id
          )
        end

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        entry = find!(id)

        if entry
          add_metadata(
            actor_account_id: auth_context.metadata[:id],
            actor_account_email: auth_context.metadata[:email],
            project_id: entry.project_id,
            dataset_id: entry.dataset_id,
            entry_id: id
          )
        end

        super(id)
      end
    end

    event(name: "selected")
    def select(id)
      no_event do
        transaction do
          # Use read scope when updating as anyone with read access can select
          update!(id, { assigned_to_id: auth_context.metadata[:id] }, scope: scoped(:read))
        end
      end
    end

    event(name: "assigned")
    def assign(id, attributes)
      no_event do
        transaction do
          update!(id, attributes)
        end
      end
    end

    event(name: "submitted")
    def submit(id, attributes)
      no_event do
        transaction do
          # Use read scope when updating as anyone with read access can submit
          update!(id, attributes, scope: scoped(:read))
        end
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
