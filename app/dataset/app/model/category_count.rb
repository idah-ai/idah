# frozen_string_literal: true

module CategoryCount
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::CategoryCounts

    field :id, type: String, primary: true
    field :project_id, type: [String, NilClass], readonly: true
    field :dataset_id, type: [String, NilClass], readonly: true
    field :entry_id, type: [String, NilClass], readonly: true
    field :category, type: String, readonly: true
    field :label, type: String, readonly: true
    field :configured, type: [TrueClass, FalseClass], readonly: true
    field :annotation_count, type: Integer, readonly: true
  end
end
