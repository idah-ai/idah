# frozen_string_literal: true

module Webhook
  # Turns a bus message into one delivery job per subscribed webhook whose owner
  # may receive it.
  class Dispatcher < Verse::Service::Base
    use_system_repo webhooks: Webhook::Repository, jobs: Jobs::Repository

    def dispatch(message)
      disable_owner_webhooks(message)

      Handlers.for_event(message.event).each do |handler|
        dispatch_handler(handler, message)
      rescue StandardError => e
        # A failing handler queues nothing; the others still run.
        Verse.logger&.error { "[WEBHOOK] #{handler.id} not dispatched: #{e.class}: #{e.message}" }
      end

      SCHEDULER.signal
    end

    private

    # A disabled or deleted account keeps its webhooks, switched off.
    def disable_owner_webhooks(message)
      account_disabled = message.content.dig(:args, 0, :enabled) == false &&
                         message.content.dig(:metadata, :previous_enabled) != false
      return unless message.event == "iam:accounts:deleted" ||
                    (message.event == "iam:accounts:updated" && account_disabled)

      webhooks.disable_for_account(message.content[:resource_id])
    end

    def dispatch_handler(handler, message)
      subscribed = subscribed_to(handler)
      return if subscribed.empty? || !handler.match.call(message)

      recipients = Access.new(auth_context).allowed(subscribed, handler.check&.call(message))
      return if recipients.empty?

      resource_id = message.content[:resource_id]
      payload = handler.payload.call(message)
      at = message.content.dig(:metadata, :at)
      at = at.iso8601(6) if at.is_a?(Time)

      recipients.each do |webhook|
        jobs.enqueue(
          job_class: DeliveryJob.name,
          arguments: { webhook_id: webhook.id, body: Delivery.envelope(event: handler.id, resource_id:, payload:) },
          webhook_id: webhook.id,
          # A bus event can be delivered twice: one job per webhook, event and occurrence.
          unicity: [webhook.id, handler.id, resource_id, at].join(":"),
          scheduled_at: Time.now
        )
      end
    end

    def subscribed_to(handler)
      webhooks.chunked_index(
        { enabled: true, events__contains: handler.id, role_name__in: handler.allowed_roles }
      ).to_a
    end
  end
end
