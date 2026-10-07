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

  json_api Webhook::Record do
    index do
      allowed_filters :name__match, :enabled, :events__contains
    end

    show
    create
    update
    delete
  end
end
