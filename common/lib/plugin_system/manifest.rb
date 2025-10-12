module PluginSystem
  ManifestSchema = Verse::Schema.define do
    field :type, String
    field :name, String
    field :version, String

    field :title, String
    field? :description, String

    field? :repository do
      field :type, String
      field :url, String
    end

    field :entry_points, key: :entryPoints do
      field(:frontend, default: {}) do
        field :scripts, [String]
        field :styles, [String]
      end

      backend_fields = Verse::Schema.define do
        field :module, String
        field :path, String
      end

      field? :backends, Verse::Schema.dictionary(backend_fields), default: {}
    end
  end

  Manifest = ManifestSchema.dataclass
end