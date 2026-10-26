# frozen_string_literal: true

module Webhook
  # Subscribable events, declared per service in handlers/<service>.rb.
  #   id: public event id; event: bus channel; allowed_roles: roles that may subscribe;
  #   match: selects the messages of this event; check: access rule for the owners
  #   (nil means none); payload: builds the delivered payload.
  module Handlers
    Definition = Data.define(:id, :event, :label, :desc, :allowed_roles, :match, :check, :payload)

    extend self

    def define(id, event:, label:, desc:, allowed_roles:, payload:, match: ->(_message) { true }, check: nil)
      registry << Definition.new(id:, event:, label:, desc:, allowed_roles:, match:, check:, payload:)
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

    # Resource attributes, read through the API as the service account.
    def fetch(resource, id, service: :dataset)
      Api[:idah].public_send(service).public_send(resource).show(id:).attributes
    end

    def resource_id(message) = message.content[:resource_id]

    # Changed attributes of an update (the first event argument).
    def changes(message) = message.content.dig(:args, 0) || {}

    def metadata(message) = message.content[:metadata] || {}

    # Access rule for the owners: the owning service checks `action` on row `id`.
    # `own_account_id` is also allowed when that account can read the row.
    def allowed(service, resource, id, action: "read", own_account_id: nil)
      { rule: "allowed", service:, action:, resource:, id:, own_account_id: }
    end

    def org(*organization_ids) = { rule: "org", organization_ids: organization_ids.compact }

    private

    def registry = (@registry ||= [])
  end
end
