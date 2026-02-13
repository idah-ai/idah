# frozen_string_literal: true

module Exports
  class Record < Verse::Model::Record::Base
    type Resource::Sync::Exports

    field :id, type: String, primary: true
    field :filename, type: String

    field :size, type: Integer
    field :mime_type, type: String

    field :created_at, type: Time
    field :updated_at, type: Time

    field :job_id, type: String

    def open
      Verse::Plugin[:shrine].with_storage do |storage|
        storage.open(id)
      rescue Shrine::FileNotFound
        raise Verse::Error::NotFound, "File not found"
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "exports"
    self.resource = Resource::Sync::Exports
  end
end
