# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    SyncExpo,
    JobsExpo
  ].each(&:register)
end
