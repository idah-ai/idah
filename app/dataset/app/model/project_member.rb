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

        scope.as_user? do
          # TODO: remove mocking
          account_id = auth_context.metadata[:id] || 1

          if action == :create
            # allow creating in projects own
            own_project_ids = Project::Repository.new(auth_context).index({ created_by_id: account_id })
            table.where(project_id: own_project_ids)
          end

          # members in the same projects
          table.where(project_id: table.where(account_id:).select(:project_id))
        end
      end
    end

    # TODO: review this as it's unscoped
    def get_permission_set(account_id, project_id)
      table.where(account_id:, project_id:).first[:permission_set]
    end

    def owner?(permission_set)
      permission_set == "owner"
    end

    def annotator?(permission_set)
      permission_set == "annotator"
    end

    def reviewer?(permission_set)
      permission_set == "reviewer"
    end
  end
end
