# frozen_string_literal: true

# Export files live under `<target prefix>/sync/files` in a project's storage
# target. Phase 1 adds the provider fetching a target's credentials.
StorageRegistry.configure(service: :sync)
