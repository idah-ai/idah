# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ExportsExpo,
    JobsExpo
  ].each(&:register)
end
