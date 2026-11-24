# frozen_string_literal: true

# Media files live under `<target prefix>/media/files` in a project's storage
# target, with credentials fetched from the setting service.
StorageRegistry.configure(service: :media, credentials_provider: StorageRegistry::SettingCredentials)
