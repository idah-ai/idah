# frozen_string_literal: true

module Project
  class Record < Verse::Model::Record::Base
    field :id, type: Integer, primary: true

    field :name, type: String
    field :description, type: String
    field :created_by_id, type: Integer

    field :created_at, type: Time
    field :updated_at, type: Time
  end

  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = "project:projects"
  end
end
