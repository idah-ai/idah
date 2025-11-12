# frozen_string_literal: true

module Annotation
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Annotations

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true
    field :dataset_id, type: String, readonly: true
    field :entry_id, type: String, readonly: true

    field :dimensions, type: Hash
    field :annotation, type: Hash

    field :created_by_email, type: String, readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "annotations"
    self.resource = Resource::Dataset::Annotations

    encoder :dimensions, Verse::Sequel::JsonEncoder
    encoder :annotation, Verse::Sequel::JsonEncoder
  end
end
