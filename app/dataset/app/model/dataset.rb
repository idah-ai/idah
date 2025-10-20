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

        scope.as_user? do
          # TODO: remove mockings
          account_id = auth_context.metadata[:id] || 1

          # project ids that is a member of
          project_ids = ProjectMember::Repository.new(auth_context).index({ account_id: }).map(&:project_id).uniq

          # datasets that are in projects that is a member of or owned datasets
          table.where(project_id: project_ids).or(created_by_id: account_id)
        end
      end
    end

    def create(attributes)
      # TODO: remove mockings
      attributes[:created_by_id] = auth_context.metadata[:id] || 1 unless attributes[:created_by_id]

      super(attributes)
    end
  end
end
