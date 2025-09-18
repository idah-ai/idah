# frozen_string_literal: true

module Medias
  class Record < Verse::Model::Record::Base
    type Resource::Media::Medias

    field :id, type: String, primary: true

    field :resource, type: String
    field :key, type: String

    field :filename, type: String

    field :size, type: Integer
    field :mime_type, type: String

    field :created_by, type: Integer
    field :created_role, type: String

    field :public, type: TrueClass

    field :created_at, type: Time
    field :updated_at, type: Time

    def open
      Verse::Plugin[:shrine].with_storage do |storage|
        storage.open(id)
      rescue Shrine::FileNotFound
        raise Verse::Error::NotFound, "File not found"
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "medias"
    self.resource = "media:medias"
  end
end
