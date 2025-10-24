# frozen_string_literal: true

module PluginSystem
  ManifestSchema = Verse::Schema.define do
    field :type, String
    field :name, String
    field :version, String

    field :title, String
    field(:description, String).default("no description provided")

    field? :modalities, Array do
      field :id, String
      field? :label, String
      field? :description, String
    end

    field? :repository do
      field :type, String
      field :url, String
    end

    field :entry_points, key: :entryPoints do
      field? :entry_plugin, key: :entryPlugin do
        field? :script, String
        field? :style, String
      end

      field? :entry_details, key: :entryDetails do
        field? :script, String
        field? :style, String
      end

      field? :dataset_config, String, key: :datasetConfig
      field? :plugin_shortcut, String, key: :pluginShortcut
      field? :assets_directory, String, key: :assetsDirectory

      field? :backend do
        field :module, Symbol
        field :path, String
      end
    end
  end

  Manifest = ManifestSchema.dataclass do
    def self.from_file(file_path)
      data = JSON.parse(File.read(file_path))
      self.new(data)
    end
  end
end
