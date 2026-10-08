# frozen_string_literal: true

module Webhook
  # Registry of subscribable events. Each service declares its events in
  # handlers/<service>.rb with `define`.
  #
  # - id: public event id users subscribe to ("<service>.<resource>.<action>")
  # - event: bus channel it listens to ("<service>:<resource>:<event>")
  # - allowed_roles: account roles allowed to subscribe
  module Handlers
    Definition = Data.define(:id, :event, :label, :desc, :allowed_roles)

    extend self

    def define(id, event:, label:, desc:, allowed_roles:)
      registry << Definition.new(id:, event:, label:, desc:, allowed_roles:)
    end

    # Definition files register on load; eager-load the namespace once.
    def all
      @all ||= begin
        Zeitwerk::Loader.eager_load_namespace(self)
        registry.sort_by(&:id).freeze
      end
    end

    def allowed_for(role) = all.select { _1.allowed_roles.include?(role.to_s) }

    private

    def registry = (@registry ||= [])
  end
end
