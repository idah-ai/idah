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
          account_id = auth_context.metadata[:id] || 1
          project_id = auth_context.metadata[:project_id] || "0199cc34-20c1-7a60-b38d-b18556496c14"

          permission_set = get_permission_set(account_id, project_id)

          case permission_set
          when "annotator"
            project_ids = table.where(account_id: account_id).select(:project_id).distinct
            table.where(project_id: project_ids).or(account_id: account_id)
          when "reviewer"
            project_ids = table.where(account_id: account_id).select(:project_id).distinct
            table.where(project_id: project_ids).or(account_id: account_id)
          end
        end

        # # scope: memberships that are in the same project as the user
        # scope.same_project? do
        #   project_ids = table.where(account_id: account_id).select(:project_id).distinct
        #   table.where(project_id: project_ids)
        # end

        # # scope: user's membership
        # scope.own? do
        #   table.where(account_id: account_id)
        # end
      end
    end

    # TODO: review this as it's unscoped
    def get_permission_set(account_id, project_id)
      # binding.pry
      table.where(account_id:, project_id:).first[:permission_set]
    end

    # TODO: review if it's used
    def annotator?(permission_set)
      return true if permission_set == "annotator"

      false
    end

    # TODO: review if it's used
    def reviewer(permission_set)
      return true if permission_set == "reviewer"

      false
    end
  end
end
