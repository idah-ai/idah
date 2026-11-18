# frozen_string_literal: true

module DatasetCategoryTotal
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::CategoryTotals

    field :id, type: String, primary: true
    field :dataset_id, type: String, readonly: true
    field :category, type: String, readonly: true
    field :annotation_count, type: Integer, readonly: true
    field :label, type: String, readonly: true
    field :configured, type: [TrueClass, FalseClass], readonly: true
  end
end
