# frozen_string_literal: true

module Webhook
  module Handlers
    module Sync
      # The job event carries only the job id, so the export is looked up by it.
      export = lambda do |message|
        Api[:idah].sync.exports.index(filter: { job_id: Handlers.resource_id(message) }).data.first
      end

      Handlers.define "sync.export.completed",
                      event: "sync:jobs:completed",
                      label: "Dataset Exported",
                      desc: "Triggered when a dataset export is ready to download",
                      allowed_roles: %w[admin org_owner user],
                      match: ->(m) { export.call(m) },
                      check: ->(m) { Handlers.allowed("sync", "sync:exports", export.call(m).id) },
                      payload: ->(m) {
                        found = export.call(m)
                        { export: { id: found.id, **found.attributes } }
                      }
    end
  end
end
