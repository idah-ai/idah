# frozen_string_literal: true

module Exports
  class Record < Verse::Model::Record::Base
    type Resource::Sync::Exports

    field :id, type: String, primary: true
    field :job_id, type: String
    field :project_id, type: String
    field :created_by_id, type: Integer

    field :file_id, type: [String, NilClass]
    field :filename, type: [String, NilClass]
    field :mime_type, type: [String, NilClass]
    field :size, type: Integer

    field :created_at, type: Time

    def open
      Verse::Plugin[:shrine].with_storage do |storage|
        storage.open(file_id)
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
