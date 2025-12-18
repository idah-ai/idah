# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    LogsExpo
  ].each(&:register)
end
