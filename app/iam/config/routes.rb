# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    OrganizationsExpo,
    AccountsExpo,
    AccountSessionsExpo,
    Auth::SimpleExpo,
    Account::PasswordsExpo,
    OrganizationsExpo,
    ApiKeysExpo,
    Auth::ApiExpo,
    ProjectMembership::CacheExpo,
  ].each(&:register)
end
