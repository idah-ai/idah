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
          table.where(table.db[:projects].where(organization_id: org_ids).select(1).exists)
        end

        scope.as_user? { account_project_scoped_query(action) }
      end
    end

    # Actions                | Roles
    # read                   | project_owner, annotator, reviewer
    # create, update, delete | project_owner, annotator, reviewer
    query
    def account_project_scoped_query(action)
      account_id = auth_context.metadata[:id]

      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = entries.project_id
            AND pm.role IN :roles
        )
      SQL

      # TODO: review
      case action
      when :create, :read, :update, :delete
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner annotator reviewer]
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
