# frozen_string_literal: true

module Entry
  class Record < Verse::Model::Record::Base
    type "dataset/entries"

    field :id, type: String, primary: true

    field :priority, type: Integer

    field :wf_step, type: String
    field :status, type: String

    field :assigned_to_id, type: Integer

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "entries"
    self.resource = "project:entries"
  end
end
