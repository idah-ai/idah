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

    field :organization_id, type: Integer

    has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    def scoped(action)
      auth_context.can!(action, Resource::Dataset::Projects) do |scope|
        scope.all? { table }
        scope.as_user? do
          org_scopes = auth_context.custom_scopes[:org]

          # TODO: finish this once base query for action checks are done
          if org_scopes.any?
            # Can access everything under the org
            table.where(organization_id: org_scopes)
            # else
            # Check project membership role then scope the record
          end
        end
      end
    end
  end
end
