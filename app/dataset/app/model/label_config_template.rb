# frozen_string_literal: true

module LabelConfigTemplate
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::LabelConfigTemplates

    field :id, type: Integer, primary: true

    field :organization_id, type: Integer, readonly: true

    field :name, type: String
    field :labeling_configuration, type: Hash
    field :modality, type: String

    field :created_by_id, type: Integer, readonly: true
    field :updated_by_id, type: Integer, readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "label_config_templates"
    self.resource = Resource::Dataset::LabelConfigTemplates

    encoder :labeling_configuration, Verse::Sequel::JsonEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          table.where(org_projects_condition | project_owner_organizations_condition)
        end

        scope.as_user? { table.where(project_owner_organizations_condition) }
      end
    end

    # Templates are visible to project_owners through any project they own,
    # scoped to that project's organization. project_owners can read, create,
    # update and delete templates within those organizations.

    def org_projects_condition
      org_ids = auth_context.custom_scopes[:org]
      return Sequel.lit("false") unless org_ids&.any?

      Sequel[:organization_id] =~ org_ids
    end

    query
    def project_owner_organizations_condition
      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          JOIN projects p ON p.id = pm.project_id
          WHERE pm.account_id = :account_id
            AND pm.disabled_at IS NULL
            AND pm.role IN :roles
            AND p.organization_id = label_config_templates.organization_id
        )
      SQL

      Sequel.lit(
        scoped_fragment,
        account_id:,
        roles: %w[project_owner]
      )
    end
  end
end
