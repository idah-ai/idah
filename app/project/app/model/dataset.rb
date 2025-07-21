# frozen_string_literal: true

module Dataset
  class Record < Verse::Model::Record::Base
    field :id, type: Integer, primary: true

    field :labels, type: Array

    field :topology, type: String, readonly: true

    field :configuration, type: Hash, readonly: true

    field :status, type: String, readonly: true
    field :progress, type: Float, readonly: true

    field :project_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "datasets"
    self.resource = "project:datasets"

    encoder :configuration, Verse::Sequel::JsonEncoder
    encoder :labels, Verse::Sequel::PgArrayEncoder
  end
end
