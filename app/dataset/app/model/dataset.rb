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
      auth_context.can!(action, Resource::Dataset::Datasets) do |scope|
        scope.all? { table }

        # scope: datasets that are in the same project as the user
        scope.same_project? do
          project_id = auth_context.metadata[:project_id] || ""
          # project_ids = table.where(account_id: account_id).select(:project_id).distinct
          table.where(project_id: )
        end

        account_id = auth_context.metadata[:id] || 1

        # scope: projects the user owns/creates
        scope.own? do
          table.where(created_by_id: account_id)
        end
      end
    end
  end
end
