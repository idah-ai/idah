# frozen_string_literal: true

Verse.on_boot do
  [
    HealthcheckExpo,
    ExportsExpo,
    JobsExpo,
    ProjectMembership::CacheExpo,
    StorageRegistry::EvictionExpo
  ].each(&:register)
end
