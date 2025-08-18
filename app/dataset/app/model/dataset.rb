# frozen_string_literal: true

module Dataset
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Datasets

    field :id, type: String, primary: true

    field :labels, type: Array

    field :modality, type: String, readonly: true

    field :labeling_configuration, type: Hash
    field :workflow_configuration, type: Hash

    field :status, type: String, readonly: true
    field :progress, type: Float, readonly: true

    field :project_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :dataset_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "datasets"
    self.resource = Resource::Dataset::Datasets

    encoder :labeling_configuration, Verse::Sequel::JsonEncoder
    encoder :workflow_configuration, Verse::Sequel::JsonEncoder
    encoder :labels, Verse::Sequel::PgArrayEncoder
  end
end
