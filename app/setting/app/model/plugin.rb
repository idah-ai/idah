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

    def self.from_path(path)
      manifest = PluginSystem::Manifest.new(
        JSON.parse(File.read(File.join(path, "manifest.json")))
      )

      new(
        source_type: "manual",
        source_path: path,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        created_at: File.ctime(path),
        updated_at: File.mtime(path)
      )
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "plugins"
    self.resource = Resource::Setting::Plugins
  end
end
