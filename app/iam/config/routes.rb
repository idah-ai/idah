# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    OrganizationsExpo,
    AccountsExpo,
    AccountSessionsExpo,
    Auth::SimpleExpo,
    Account::PasswordsExpo
  ].each(&:register)
end
