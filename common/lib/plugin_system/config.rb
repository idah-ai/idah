module PluginSystem
  ConfigSchema = Verse::Schema.define do
    field :path, String, default: "plugins"
    field :manual, Array, of: String, default: []
  end

  Config = ConfigSchema.dataclass
end