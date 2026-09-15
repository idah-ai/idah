# frozen_string_literal: true

require "net/http"
require "json"

module QcWorkflow
  # Sends the annotations of an entry to the configured external QC application.
  #
  # Configuration is read from `dataset.workflow_configuration["qc"]`:
  #   {
  #     "qc": {
  #       "endpoint": "https://qc-app.example.com/annotations",
  #       "callback_token": "a-shared-secret"
  #     }
  #   }
  #
  # The payload includes the callback URL that the external app uses to
  # return its result to IDAH (`POST /entries/:id/workflow_callback`).
  class QcClient
    class << self
      def call(entry)
        wf_config = entry.dataset.workflow_configuration || {}
        qc_config = wf_config[:qc] || wf_config["qc"] || {}
        endpoint  = qc_config[:endpoint] || qc_config["endpoint"]
        return unless endpoint

        callback_token = qc_config[:callback_token] || qc_config["callback_token"]
        idah_url = ENV.fetch("IDAH_URL", "https://idah.localhost:8443")

        payload = {
          entry_id: entry.id,
          entry_name: entry.name,
          qc_callback_url: "#{idah_url}/api/v1/dataset/entries/#{entry.id}/workflow_callback",
          callback_token: callback_token,
          annotations: (entry.annotations || []).map do |annotation|
            {
              id: annotation.id,
              dimensions: annotation.dimensions,
              annotation: annotation.annotation,
              metadata: annotation.metadata
            }
          end
        }

        Thread.new do
          uri = URI(endpoint)
          http = Net::HTTP.new(uri.host, uri.port)
          http.open_timeout = 5
          http.read_timeout = 5

          request = Net::HTTP::Post.new(uri.request_uri)
          request.body = payload.to_json
          request["Content-Type"] = "application/json"

          response = http.request(request)
          Verse.logger&.info("[QC] Sent to #{endpoint} — response: #{response.code}")
        rescue StandardError => e
          Verse.logger&.error("[QC] Failed to send to #{endpoint}: #{e.message}")
        end
      end
    end
  end
end
