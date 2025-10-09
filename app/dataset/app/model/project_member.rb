# frozen_string_literal: true

module ProjectMember
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::ProjectMembers

    field :id, type: Integer, primary: true

    field :project_id, type: String, readonly: true

    field :account_id, type: Integer, readonly: true
    field :name, type: [String, NilClass]
    field :email, type: String

    field :permission_set, type: String

    field :invited_by_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
  end

  # TODO: temporary mocking account_id value, need to implement login/authentication
  class Repository < Verse::Sequel::Repository
    self.table = "project_members"
    self.resource = Resource::Dataset::ProjectMembers

    # scope(s) definition
    def scoped(action)
      auth_context.can!(action, Resource::Dataset::ProjectMembers) do |scope|
        scope.all? { table }

        account_id = auth_context.metadata[:id] || 1

        # scope: memberships that are in the same project as the user
        scope.same_project? do
          project_ids = table.where(account_id: account_id).select(:project_id).distinct
          table.where(project_id: project_ids)
        end

        # scope: user's membership
        scope.own? do
          table.where(account_id: account_id)
        end
      end
    end
  end
end
