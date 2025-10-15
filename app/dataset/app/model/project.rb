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

        # fetch membership here ?
        # TODO: remove mockings
        account_id = auth_context.metadata[:id] || 1
        project_ids = auth_context.metadata[:project_id] || "0199cc34-20c1-7a60-b38d-b18556496c14"

        next unless account_id && project_ids

        # scope.annotator? do
        # end

        # scope: projects the user is a member of
        scope.member? do
          project_member_repo = ProjectMember::Repository.new(auth_context)
          project_ids = project_member_repo.index({ account_id: }).map(&:project_id).uniq

          table.where(id: project_ids) # member of the project
               .or(created_by_id: account_id) # own/created the project
        end

        scope.membership? do
          # get permission set name from the project membership
          # permission_set_name = ProjectMember::Repository.new(auth_context).find_by(
          #   {
          #     account_id: account_id,
          #     project_id: project_ids
          #   }
          # )&.permission_set

          # # rights from membership's permission set
          # permission_set_rights = Verse::Auth::Context.backend.fetch(permission_set_name)

          # next if permission_set_rights.empty?

          # @auth_context = Verse::Auth::Context.from_role(permission_set_name)
          @auth_context = ContextHelper.membership_context(auth_context)

          # next unless

          scoped(action)
        end
      end
    end

    # superclass method(s) implementation
    def create(attributes)
      # TODO: remove mockings
      attributes[:created_by_id] = auth_context.metadata[:id] || 1 unless attributes[:created_by_id]

      super(attributes)
    end
  end
end
