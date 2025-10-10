# frozen_string_literal: true

module Dataset
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Datasets

    field :id, type: String, primary: true
    field :name, type: String

    field :labels, type: Array

    field :modality, type: String, readonly: true

    field :labeling_configuration, type: Hash
    field :workflow_configuration, type: Hash

    field :status, type: String, readonly: true
    field :progress, type: Float, readonly: true

    field :project_id, type: Integer, readonly: true

    field :created_by_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :dataset_id

    def entry_workflow
      Workflow::EntryWorkflow
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "datasets"
    self.resource = Resource::Dataset::Datasets

    encoder :labeling_configuration, Verse::Sequel::JsonEncoder
    encoder :workflow_configuration, Verse::Sequel::JsonEncoder
    encoder :labels, Verse::Sequel::PgArrayEncoder

    # scope definition(s)
    def scoped(action)
      account_id = auth_context.metadata[:id] || 1

      # auth_context.can!(action, Resource::Dataset::Datasets) do |scope|
      combined_context.can!(action, Resource::Dataset::Datasets) do |scope|
        scope.all? { table }

        scope.own_project? do
          project_repo = Project::Repository.new(auth_context)
          project_ids = project_repo.index({ created_by_id: account_id }).map(&:id).uniq

          table.where(project_id: project_ids)
        end

        # scope: datasets that are in the same project as the user
        scope.same_project? do
          project_id = auth_context.metadata[:project_id] || ""
          # project_ids = table.where(account_id: account_id).select(:project_id).distinct
          table.where(project_id: )
        end

        # scope: projects the user owns/creates
        scope.own? do
          table.where(created_by_id: account_id)
        end
      end
    end

    # TODO: move to a dedicated place to be called from repositories
    # TODO: determine how and where we can cache the permissions properly
    private def combined_context
      # TODO: remove mockings
      account_id = auth_context.metadata[:id] || 1
      project_ids = auth_context.metadata[:project_id] || "0199cc34-20c1-7a60-b38d-b18556496c14"

      return auth_context unless account_id && project_ids

      # get permission set name from the project membership
      permission_set_name = ProjectMember::Repository.new(auth_context).find_by(
        {
          account_id: account_id,
          project_id: project_ids
        }
      )&.permission_set

      # rights from membership's permission set
      permission_set_rights = Verse::Auth::Context.backend.fetch(permission_set_name)

      return auth_context if permission_set_rights.empty?

      # rights from current account context
      account_rights = Verse::Auth::Context.backend.fetch(auth_context.role)

      # merge rights
      combined_rights = (account_rights + permission_set_rights).uniq

      # return a context with combined rights
      Verse::Auth::Context.new(
        combined_rights,
        role: auth_context.role, # Keep original role name
        custom_scopes: auth_context.custom_scopes,
        metadata: auth_context.metadata
      )
    end
  end
end
