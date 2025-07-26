# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
  ].each(&:register)
end
