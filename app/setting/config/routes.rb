# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    AccountSettingsExpo,
    SettingsExpo,
    PluginsExpo
  ].each(&:register)
end
