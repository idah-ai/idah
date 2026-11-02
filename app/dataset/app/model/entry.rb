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

    field :name, type: String

    field :assigned_to_id, type: [Integer, NilClass]
    field :assigned_to_email, type: [String, NilClass]
    field :submitted_by_id, type: [Integer, NilClass]
    field :submitted_by_email, type: [String, NilClass]
    field :reviewed_by_id, type: [Integer, NilClass]
    field :reviewed_by_email, type: [String, NilClass]

    field :reopened_by_id, type: [Integer, NilClass]
    field :reopened_by_email, type: [String, NilClass]

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id

    # Resolve the project member by BOTH project_id and account_id, so an entry
    # only matches a membership in its OWN project. A plain account_id join (the
    # previous belongs_to) could pick up the same account's membership in an
    # unrelated project, leaking that row and showing a stray/stale assignee.
    def self.belongs_to_project_member(relation_name, foreign_key)
      relation relation_name, array: false do |collection, auth_context, sub_included|
        members = ProjectMember::Repository.new(auth_context).index(
          {
            account_id__in: collection.map { |entry| entry[foreign_key] }.compact.uniq,
            project_id__in: collection.map { |entry| entry[:project_id] }.uniq
          },
          included: sub_included
        )

        [
          members,
          ->(member) { "#{member[:project_id]}:#{member[:account_id]}" }, # index members by (project, account)
          ->(entry) { "#{entry[:project_id]}:#{entry[foreign_key]}" }     # look up by the entry's own project
        ]
      end
    end

    belongs_to_project_member :assigned_to, :assigned_to_id
    belongs_to_project_member :submitted_by, :submitted_by_id
    belongs_to_project_member :reviewed_by, :reviewed_by_id
    belongs_to_project_member :reopened_by, :reopened_by_id

    has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
    has_many :entry_stats, repository: "EntryStat::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    include ActorEventMetadata

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

    custom_filter :assigned do |collection, value|
      assigned = value.to_s.downcase == "true"

      if assigned
        collection.where(Sequel.lit("assigned_to_id IS NOT NULL"))
      else
        collection.where(Sequel.lit("assigned_to_id IS NULL"))
      end
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          if auth_context.custom_scopes[:project]
            # API-key project scope: no membership union.
            table.where(project_id: auth_context.custom_scopes[:project])
          else
            table.where(org_projects_condition | user_project_scoped_condition(action))
          end
        end

        scope.as_user? { table.where(user_project_scoped_condition(action)) }
      end
    end

    # Actions                | Roles
    # read                   | project_owner, annotator(assigned), reviewer(assigned)
    # create, update, delete | project_owner
    #
    # Info:
    # 1. project_owner can create, update and delete entries
    # 2. annotator and reviewer can only read entries assigned to them

    def org_projects_condition
      org_ids = auth_context.custom_scopes[:org]
      return Sequel.lit("false") unless org_ids&.any?

      table.db[:projects]
           .where(organization_id: org_ids)
           .where(id: Sequel[:entries][:project_id])
           .select(1).exists
    end

    query
    def user_project_scoped_condition(action)
      # Ignore create action as it will be handled in service layer
      return Sequel.lit("true") if action == :create

      account_id = auth_context.metadata[:id]

      case action
      when :read, :submit
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = entries.project_id
              AND pm.disabled_at IS NULL
              AND (
                -- All with roles
                pm.role IN :with_roles OR
                -- Annotators can access only assigned annotate-stage entries
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

        Sequel.lit(
          scoped_fragment,
          account_id:,
          with_roles: %w[project_owner],
          annotator_roles: %w[annotator],
          reviewer_roles: %w[reviewer]
        )
      when :update, :delete
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = entries.project_id
              AND pm.disabled_at IS NULL
              AND pm.role IN :roles
          )
        SQL

        Sequel.lit(
          scoped_fragment,
          account_id:,
          roles: %w[project_owner]
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    def create(attributes)
      with_metadata do
        add_event_metadata(
          project_id: attributes[:project_id],
          dataset_id: attributes[:dataset_id]
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        entry = find!(id)

        add_event_metadata(
          project_id: attributes[:project_id] || entry.project_id,
          dataset_id: attributes[:dataset_id] || entry.dataset_id,
          entry_id: id
        )

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        entry = find!(id)

        add_event_metadata(
          project_id: entry.project_id,
          dataset_id: entry.dataset_id,
          entry_id: id
        )

        super(id)
      end
    end

    event(name: "selected")
    def select(id)
      no_event do
        transaction do
          entry = find!(id)

          if entry.status == "pending"
            update!(
              id,
              {
                assigned_to_id: auth_context.metadata[:id],
                assigned_to_email: auth_context.metadata[:email],
                status: "in_progress"
              },
              scope: scoped(:read)
            )
          end
        end
      end
    end

    event(name: "assigned")
    def assign(id, assigned_to_id, assigned_to_email)
      entry = find!(id)

      add_event_metadata(
        project_id: entry.project_id,
        dataset_id: entry.dataset_id,
        entry_id: id
      )

      no_event do
        transaction do
          update!(id, { assigned_to_id:, assigned_to_email:, status: "in_progress" })
        end
      end
    end

    event(name: "unassigned")
    def unassign(id)
      entry = find!(id)

      add_event_metadata(
        project_id: entry.project_id,
        dataset_id: entry.dataset_id,
        entry_id: id
      )

      no_event do
        transaction do
          update!(id, { assigned_to_id: nil, assigned_to_email: nil, status: "pending" })
        end
      end
    end

    event(name: "reopened")
    def reopen(id, attributes)
      entry = find!(id)

      add_event_metadata(
        project_id: entry.project_id,
        dataset_id: entry.dataset_id,
        entry_id: id
      )

      no_event do
        transaction do
          update!(id, attributes, scope: scoped(:update))
        end
      end
    end

    event(name: "submitted")
    def submit(id, attributes)
      entry = find!(id)

      add_event_metadata(
        project_id: attributes[:project_id] || entry.project_id,
        dataset_id: attributes[:dataset_id] || entry.dataset_id,
        entry_id: id,
        submission_type: entry.wf_step
      )

      no_event do
        transaction do
          # Use read scope when updating as anyone with read access can submit
          update!(id, attributes, scope: scoped(:read))
        end
      end
    end

    event(name: "errored")
    def error(id, attributes)
      entry = find!(id)

      add_event_metadata(
        project_id: attributes[:project_id] || entry.project_id,
        dataset_id: attributes[:dataset_id] || entry.dataset_id,
        entry_id: id
      )

      no_event do
        transaction do
          update!(id, attributes)
        end
      end
    end

    def mark_entries_status_as(job_id, status)
      entry = find_by!({ job_id: job_id, status: "processing" })

      transaction do
        update!(entry.id, { status: })
      end
    end

    private

    def add_event_metadata(**opts)
      add_metadata(**opts)
    end
  end
end
