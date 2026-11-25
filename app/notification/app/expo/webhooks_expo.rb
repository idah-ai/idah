# frozen_string_literal: true

class WebhooksExpo < BaseExpo
  http_path "/webhooks"

  use_service Webhook::Service

  # Declared before the json_api routes so `/events` isn't matched as `/:id`.
  expose on_http(:get, "/events") do
    desc <<~MD
      List the events a webhook can subscribe to with the current role.
    MD
    output Verse::JsonApi::Util.jsonapi_record(Webhook::EventRecord)
  end
  def events
    service.events
  end

  expose on_http(:post, "/:id/test", renderer: Verse::Http::Renderer::Json) do
    desc <<~MD
      Send a signed `ping` to the webhook URL now and return the receiver's
      answer. Works on disabled webhooks; the ping is not retried or logged.
    MD
    input do
      field(:id, Integer)
    end
  end
  def test_webhook
    service.test(params[:id])
  end

  json_api Webhook::Record do
    index do
      allowed_filters :name__match, :enabled, :events__contains
    end

    show
    create
    update
    delete
  end

  def on_webhook_event
    auth_context.mark_as_checked!

    Webhook::Dispatcher.new(auth_context).dispatch(message)
  end

  # Account deletions have no handler, so their channel is subscribed here.
  (Webhook::Handlers.channels + ["iam:accounts:deleted"]).uniq.each do |channel|
    resource, _, event = channel.rpartition(":")

    attach_exposition(
      :on_webhook_event,
      build_expose(on_resource_event(resource, event)) do
        desc "Queue deliveries to the webhooks subscribed to `#{channel}`."
      end
    )
  end
end
