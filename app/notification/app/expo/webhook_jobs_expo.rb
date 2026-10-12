# frozen_string_literal: true

# Delivery log of a webhook: one job per delivery (and per test ping).
class WebhookJobsExpo < BaseExpo
  http_path "/webhooks/:webhook_id/jobs"

  use_service Jobs::Service

  json_api Jobs::Record do
    base_schema do
      field(:webhook_id, Integer)
    end

    index do
      allowed_filters :status, :status__in, :http_code, :created_at__gte, :created_at__lte

      body do |_, default_body|
        params[:filter] ||= {}
        params[:filter][:webhook_id] = params[:webhook_id]

        default_body.call
      end
    end

    show
  end

  expose on_schedule("30 0 * * *") do
    desc <<~MD
      Daily at 00:30: delete deliveries finished more than 30 days ago and
      requeue jobs left running by a stopped process.
    MD
  end
  def cleanup
    service.cleanup
  end
end
