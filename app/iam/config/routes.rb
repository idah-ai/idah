# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    AccountsExpo,
    Auth::SimpleExpo
  ].each(&:register)
end
