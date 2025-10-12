module PluginSystem
  ManifestSchema = Verse::Schema.define do
    field :type, String
    field :name, String
    field :version, String

    field :title, String
    field :description, String

    field :repository do
      field :type, String
      field :url, String
    end

    field :entryPoints do
      field? :frontend do
        field :scripts, [String]
        field :styles, [String]
      end

      field? :backends do
        field :module, String
        field :path, String
      end
    end
  end

  Manifest = ManifestSchema.dataclass
end