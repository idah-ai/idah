# frozen_string_literal: true

module EntryStat
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::EntryStats

    field :id,       type: String, primary: true
    field :entry_id, type: String, readonly: true
    field :key,      type: String
    field :value,    type: String

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entry_stats"
    self.resource = Resource::Dataset::EntryStats

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
                .where(Sequel[:entries][:id] => Sequel[:entry_stats][:entry_id])
                .select(1).exists
            )
          elsif project_ids
            table.where(
              table.db[:entries]
                .where(project_id: project_ids)
                .where(id: Sequel[:entry_stats][:entry_id])
                .select(1).exists
            )
          else
            table.where(Sequel.lit("false"))
          end
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions | Roles
    # read    | project_owner, annotator (assigned), reviewer (assigned)
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
            WHERE e.id = entry_stats.entry_id
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

    def delete_by_entry_id(entry_id)
      table.where(entry_id:).delete
    end

    def bulk_insert(entry_id, stats_hash)
      now = Time.now
      rows = stats_hash.map do |key, value|
        {
          id: UUIDv7.generate,
          entry_id:,
          key: key.to_s,
          value: value.to_s,
          created_at: now,
          updated_at: now
        }
      end

      table.db[:entry_stats].multi_insert(rows) unless rows.empty?
    end
  end
end
