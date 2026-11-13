# frozen_string_literal: true

module EntryWorkTime
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::EntryWorkTimes

    field :id, type: String, primary: true
    field :entry_id, type: String, readonly: true
    field :account_id, type: Integer
    field :wf_step, type: String
    field :seconds, type: Integer
    field :session_started_at, type: Time
    field :email, type: String

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entry_work_times"
    self.resource = Resource::Dataset::EntryWorkTimes

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          project_ids = auth_context.custom_scopes[:project]
          if org_ids
            table.where(
              table.db[:entries]
                .join(:projects, id: :project_id)
                .where(organization_id: org_ids)
                .where(Sequel[:entries][:id] => Sequel[:entry_work_times][:entry_id])
                .select(1).exists
            )
          elsif project_ids
            table.where(
              table.db[:entries]
                .where(project_id: project_ids)
                .where(id: Sequel[:entry_work_times][:entry_id])
                .select(1).exists
            )
          else
            table.where(Sequel.lit("false"))
          end
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    query
    def user_project_scoped_query(action)
      account_id = auth_context.metadata[:id]

      case action
      when :read
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM entries e
            JOIN project_members pm ON pm.project_id = e.project_id
            WHERE e.id = entry_work_times.entry_id
              AND pm.account_id = :account_id
              AND pm.disabled_at IS NULL
              AND (
                pm.role IN :owner_roles OR
                (pm.role IN :member_roles AND e.assigned_to_id = :account_id)
              )
          )
        SQL

        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            owner_roles: %w[project_owner],
            member_roles: %w[annotator reviewer]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    # Upsert: create a new open row if none exists, otherwise keep the existing open row.
    # Email is set on first touch and never changed.
    def upsert_open_row(entry_id, account_id, wf_step, session_started_at, email)
      table.insert_conflict(
        target: %i[entry_id account_id wf_step],
        conflict_where: Sequel.lit("session_started_at IS NOT NULL"),
        update: {
          session_started_at: Sequel.lit("COALESCE(entry_work_times.session_started_at, EXCLUDED.session_started_at)"),
          email: Sequel.lit("COALESCE(entry_work_times.email, EXCLUDED.email)"),
          updated_at: Time.now
        }
      ).insert(
        id: UUIDv7.generate,
        entry_id:,
        account_id:,
        wf_step:,
        seconds: 0,
        session_started_at:,
        email:
      )
    end

    # Finalize this session row: set its seconds and null the session_started_at marker.
    def finalize_session(id, seconds)
      table.where(id:).update(
        seconds:,
        session_started_at: nil,
        updated_at: Time.now
      )
    end

    # Find all open sessions for (entry, step)
    def open_sessions_for(entry_id, wf_step)
      table.where(entry_id:, wf_step:).exclude(session_started_at: nil).all
    end
  end
end
