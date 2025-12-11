# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    AccountsExpo,
    AccountSessionsExpo,
    Auth::SimpleExpo,
    Account::PasswordsExpo,
    OrganizationsExpo
  ].each(&:register)
end
