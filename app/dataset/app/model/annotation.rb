# frozen_string_literal: true

module Annotation
  class Record < Verse::Model::Record::Base
    field :id, type: String, primary: true

    field :entry_id, type: Integer, readonly: true

    field :type, type: String
    field :dimensions, type: Hash
    field :annotation, type: Hash

    field :created_by_id, type: Integer, readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "annotations"
    self.resource = "project:annotations"

    encoder :dimensions, Verse::Sequel::JsonEncoder
    encoder :annotation, Verse::Sequel::JsonEncoder
  end
end
