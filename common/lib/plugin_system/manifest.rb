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
      field? :frontend do
        field? :scripts, Array, of: String
        field? :styles, Array, of: String
      end

      field? :backend do
        field :module, Symbol
        field :path, String
      end
    end
  end

  Manifest = ManifestSchema.dataclass
end