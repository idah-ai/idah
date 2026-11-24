# frozen_string_literal: true

# Media files live under `<target prefix>/media/files` in a project's storage
# target. Phase 1 adds the provider fetching a target's credentials.
StorageRegistry.configure(service: :media)
