# frozen_string_literal: true

module Medias
  class Record < Verse::Record::Base
    field :id, type: Integer, primary: true

    field :key, type: String

    field :size, type: Integer
    field :mime_type, type: String

    field :created_by, type: Integer
    field :created_role, type: String

    field :public, type: Boolean

    field :created_at, type: Time
    field :updated_at, type: Time
  end

  class Repository < Verse::Sequel::Repository
    self.table = "medias"
    self.resource = "medias:medias"
  end
end
