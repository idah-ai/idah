# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ExportsExpo,
    JobsExpo,
    ProjectMembership::CacheExpo,
    AccessExpo
  ].each(&:register)
end
