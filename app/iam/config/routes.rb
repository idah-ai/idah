# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    AccountsExpo,
  ].each(&:register)
end
