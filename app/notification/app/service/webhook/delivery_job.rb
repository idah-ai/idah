# frozen_string_literal: true

module Webhook
  # Sends one queued delivery. A non-2xx answer or a network error fails the
  # attempt, and the scheduler retries it with backoff.
  class DeliveryJob < Jobs::Base
    self.max_retries = 8

    def run_impl
      webhook = webhooks.find(arguments[:webhook_id])
      return unless webhook

      unless webhook.enabled
        update_job(response: "not sent: webhook disabled")
        return
      end

      begin
        http_code, response = Delivery.post(webhook, arguments[:body])
      rescue StandardError
        update_job(http_code: nil, response: nil)
        raise
      end

      update_job(http_code:, response:)
      error("HTTP #{http_code}") unless Delivery.success?(http_code)
    end

    private

    def update_job(attributes) = jobs.no_event { _1.update!(job_id, attributes) }

    def webhooks = Webhook::Repository.new(Verse::Auth::Context[:system])

    def jobs = Jobs::Repository.new(Verse::Auth::Context[:system])
  end
end
