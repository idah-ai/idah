# frozen_string_literal: true

module Annotation
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Annotations

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true
    field :dataset_id, type: String, readonly: true
    field :entry_id, type: String, readonly: true

    field :dimensions, type: Hash
    field :annotation, type: Hash

    field :created_by_email, type: String, readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "annotations"
    self.resource = Resource::Dataset::Annotations

    encoder :dimensions, Verse::Sequel::JsonEncoder
    encoder :annotation, Verse::Sequel::JsonEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(
            table.db[:projects]
              .where(organization_id: org_ids)
              .where(id: Sequel[:annotations][:project_id])
              .select(1).exists
          )
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions                       | Roles
    # read, create, update, delete  | project_owner, annotator, reviewer
    #
    # Info:
    # 1. project_owner can create, update and delete annotations
    # 2. annotator and reviewer project members can create, update, delete and read
    # annotations only for entries assigned to them
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]

      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = annotations.project_id
            AND (
              -- All with roles
              pm.role IN :with_roles OR
              (
                -- From assigned entries with roles
                pm.role IN :assigned_to_roles AND
                EXISTS (
                  SELECT 1
                  FROM entries e
                  WHERE e.id = annotations.entry_id
                    AND e.assigned_to_id = pm.id
                )
              )
            )
        )
      SQL

      case action
      when :read, :update, :delete
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            with_roles: %w[project_owner],
            assigned_to_roles: %w[annotator reviewer]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end
  end
end
