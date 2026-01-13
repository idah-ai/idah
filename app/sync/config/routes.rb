# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    SyncExpo,
    ExportsExpo,
    JobsExpo
  ].each(&:register)
end
