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

    # use_repo project_member_repo: ProjectMember::Repository

    # scope definition(s)
    def scoped(action)
      # use membership_context as it also includes permissions of the member in the project
      # auth_context.can!(action, Resource::Dataset::Datasets) do |scope|
      auth_context.can!(action, Resource::Dataset::Datasets) do |scope|
        account_id = auth_context.metadata[:id] || 1

        scope.all? { table }

        scope.as_user? do
          # TODO: remove mockings
          account_id = auth_context.metadata[:id] || 1
          project_id = auth_context.metadata[:project_id] || "0199cc34-20c1-7a60-b38d-b18556496c14"

          permission_set = ProjectMember::Repository.new(auth_context).get_permission_set(account_id, project_id)

          case permission_set
          when "annotator"
            # project_ids = table.where(account_id: account_id).select(:project_id).distinct
            table.where(created_by_id: account_id)
          when "reviewer"
            # project_ids = table.where(account_id: account_id).select(:project_id).distinct
            table.where(project_id: project_id).or(created_by_id: account_id)
          end
        end
      end
    end
  end
end
