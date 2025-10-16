# frozen_string_literal: true

module PluginSystem
  ConfigSchema = Verse::Schema.define do
    field :path, String, default: "plugins"
    field :manual, Array, of: String, default: []
    field :watch, TrueClass, default: false
  end

  Config = ConfigSchema.dataclass
end
