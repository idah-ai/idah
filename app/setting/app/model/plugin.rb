# frozen_string_literal: true

module Plugin
  class Record < Verse::Model::Record::Base
    type Resource::Setting::Plugins

    field :id, type: Integer, primary: true
    field :source_type, type: String, readonly: true
    field :source_path, type: String, readonly: true

    field :name, type: String, readonly: true
    field :description, type: String, readonly: true

    field :version, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
  end

  class Repository < Verse::Sequel::Repository
    self.table = "plugins"
    self.resource = Resource::Setting::Plugins
  end
end
