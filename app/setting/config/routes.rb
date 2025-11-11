# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    UserSettingsExpo,
    SettingsExpo,
    PluginsExpo
  ].each(&:register)
end
