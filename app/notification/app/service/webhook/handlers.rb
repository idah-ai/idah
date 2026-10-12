# frozen_string_literal: true

module Webhook
  # Registry of subscribable events. Each service declares its events in
  # handlers/<service>.rb with `define`.
  #
  # - id: public event id users subscribe to ("<service>.<resource>.<action>")
  # - event: bus channel it listens to ("<service>:<resource>:<event>")
  # - allowed_roles: account roles allowed to subscribe
  # - match: whether a bus message is this event (several events can share a channel)
  # - payload: builds the delivered `payload` from the bus message
  module Handlers
    Definition = Data.define(:id, :event, :label, :desc, :allowed_roles, :match, :payload)

    extend self

    def define(id, event:, label:, desc:, allowed_roles:, payload:, match: ->(_message) { true })
      registry << Definition.new(id:, event:, label:, desc:, allowed_roles:, match:, payload:)
    end

    # Definition files register on load; eager-load the namespace once.
    def all
      @all ||= begin
        Zeitwerk::Loader.eager_load_namespace(self)
        registry.sort_by(&:id).freeze
      end
    end

    def allowed_for(role) = all.select { _1.allowed_roles.include?(role.to_s) }

    def for_event(event) = all.select { _1.event == event }

    def channels = all.map(&:event).uniq

    # Attributes of a dataset resource, read through the API as the service account.
    def fetch(resource, id)
      Api[:idah].dataset.public_send(resource).show(id:).attributes
    end

    def resource_id(message) = message.content[:resource_id]

    # Changed attributes of an update (the first event argument).
    def changes(message) = message.content.dig(:args, 0) || {}

    def metadata(message) = message.content[:metadata] || {}

    private

    def registry = (@registry ||= [])
  end
end
