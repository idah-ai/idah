# frozen_string_literal: true

module Webhook
  # Sends one queued delivery. A non-2xx answer or a network error fails the
  # attempt, and the scheduler retries it with backoff.
  class DeliveryJob < Jobs::Base
    self.max_retries = 8

    def run_impl
      webhook = webhooks.find(arguments[:webhook_id])
      return unless webhook&.enabled

      begin
        http_code, response = Delivery.post(webhook, arguments[:body])
      rescue StandardError
        jobs.update!(job_id, { http_code: nil, response: nil })
        raise
      end

      jobs.update!(job_id, { http_code:, response: })
      error("HTTP #{http_code}") unless Delivery.success?(http_code)
    end

    private

    def webhooks = Webhook::Repository.new(Verse::Auth::Context[:system])

    def jobs = Jobs::Repository.new(Verse::Auth::Context[:system])
  end
end
