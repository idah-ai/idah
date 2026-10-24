# frozen_string_literal: true

module Webhook
  # Turns a bus message into one delivery job per webhook subscribed to it.
  class Dispatcher < Verse::Service::Base
    use_system_repo webhooks: Webhook::Repository, jobs: Jobs::Repository

    def dispatch(message)
      Handlers.for_event(message.event).each do |handler|
        next unless handler.match.call(message)

        recipients = recipients_for(handler)
        next if recipients.empty?

        resource_id = message.content[:resource_id]
        payload = handler.payload.call(message)

        recipients.each do |webhook|
          jobs.enqueue(
            job_class: DeliveryJob.name,
            arguments: { webhook_id: webhook.id, body: Delivery.envelope(event: handler.id, resource_id:, payload:) },
            webhook_id: webhook.id,
            # The bus can deliver an event twice; this keeps one job per webhook and event.
            unicity: [webhook.id, handler.id, resource_id, message.content.dig(:metadata, :at)].join(":"),
            scheduled_at: Time.now
          )
        end
      end

      SCHEDULER.signal
    end

    private

    def recipients_for(handler)
      webhooks.chunked_index(
        { enabled: true, events__contains: handler.id, role_name__in: handler.allowed_roles }
      ).to_a
    end
  end
end
