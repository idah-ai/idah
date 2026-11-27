# frozen_string_literal: true

module TotalCategoryCount
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::TotalCategoryCounts

    field :id, type: String, primary: true
    field :project_id, type: [String, NilClass], readonly: true
    field :dataset_id, type: [String, NilClass], readonly: true
    field :entry_id, type: [String, NilClass], readonly: true
    field :annotation_count, type: Integer, readonly: true
  end
end
