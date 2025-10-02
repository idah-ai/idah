# frozen_string_literal: true

module Project
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Projects

    field :id, type: String, primary: true

    field :name, type: String
    field :description, type: String

    field :created_by_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
  end

  # TODO: temporary mocking account_id value, need to implement login/authentication
  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    # scope definition(s)
    def scoped(action)
      auth_context.can!(action, Resource::Dataset::Projects) do |scope|
        scope.all? { table }

        account_id = auth_context.metadata[:id] || 1

        # scope: projects the user owns/creates
        scope.own? do
          table.where(created_by_id: account_id)
        end

        # scope: projects the user is a member of
        scope.member? do
          project_member_repo = ProjectMember::Repository.new(auth_context)
          project_ids = project_member_repo.index({ account_id: }).map(&:project_id).uniq

          project_ids&.any? ? table.where(id: project_ids) : table.where(Sequel.lit("false"))
        end
      end
    end

    # superclass method(s) implementation
    def create(attributes)
      attributes[:created_by_id] = auth_context.metadata[:id] || 1 unless attributes[:created_by_id]

      super(attributes)
    end
  end
end
