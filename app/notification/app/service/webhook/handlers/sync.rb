# frozen_string_literal: true

module Webhook
  module Handlers
    module Sync
      # The export's file is attached when its export job finishes.
      Handlers.define "sync.export.completed",
                      event: "sync:exports:updated",
                      label: "Dataset Exported",
                      desc: "Triggered when a dataset export is ready to download",
                      allowed_roles: %w[admin org_owner user],
                      match: ->(m) { Handlers.changes(m)[:file_id] },
                      check: ->(m) { Handlers.allowed("sync", "sync:exports", Handlers.resource_id(m)) },
                      payload: ->(m) { { export: Handlers.fetch(:exports, Handlers.resource_id(m), service: :sync) } }
    end
  end
end
