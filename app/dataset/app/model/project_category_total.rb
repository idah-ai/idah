# frozen_string_literal: true

module ProjectCategoryTotal
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::ProjectCategoryTotals

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true
    field :category, type: String, readonly: true
    field :label, type: String, readonly: true
    field :annotation_count, type: Integer, readonly: true
    field :configured, type: [TrueClass, FalseClass], readonly: true
    field :label_conflict, type: [TrueClass, FalseClass], readonly: true
    field :datasets, type: Array, readonly: true
  end
end
