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

    has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_user? do
          ScopedQuery.projects(table, action, auth_context.metadata[:id])
        end
      end
    end
  end
end
