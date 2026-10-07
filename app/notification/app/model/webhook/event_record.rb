# frozen_string_literal: true

module Webhook
  # An event users can subscribe a webhook to, built from a handler definition.
  class EventRecord < Verse::Model::Record::Base
    type "notification:webhook_events"

    field :id, type: String, primary: true
    field :event, type: String
    field :label, type: String
    field :description, type: String
    field :allowed_roles, type: Array
  end
end
