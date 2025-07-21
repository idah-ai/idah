# frozen_string_literal: true

module Project
  class Record < Verse::Model::Record::Base
    field :id, type: Integer, primary: true

    field :name, type: String
    field :description, type: String
    field :created_by_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = "project:projects"
  end
end
