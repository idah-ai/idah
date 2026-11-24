# frozen_string_literal: true

# Export files live under `<target prefix>/sync/files` in a project's storage
# target, with credentials fetched from the setting service.
StorageRegistry.configure(service: :sync, credentials_provider: StorageRegistry::SettingCredentials)
