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
        {
          source_type: "manual",
          source_path: path,
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          created_at: File.ctime(path),
          updated_at: File.mtime(path)
        }
      )
    end

    def path
      @path ||= \
        begin
          plugin_path = Verse.config.extra_fields.dig(
            :idah, :plugins, :path
          ) || "plugins/**"

          if source_type == "manual"
            source_path
          else
            plugin_path.split(";").each do |path|
              Dir.glob(path).each do |dir|
                local_plugin_name = dir.split("/").last
                curent_plugin_name = "#{name}-#{version}"

                next unless local_plugin_name == curent_plugin_name

                return File.join(dir)
              end
            end

            raise "Plugin path not found for plugin #{name}-#{version}"
          end
        end
    end

    def manifest
      @manifest ||= begin
        manifest_path = File.join(path, "manifest.json")

        if File.exist?(manifest_path)
          PluginSystem::Manifest.from_file(manifest_path)
        end
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "plugins"
    self.resource = Resource::Setting::Plugins
  end
end
