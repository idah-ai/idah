# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ExportExpo,
    JobsExpo
  ].each(&:register)
end
