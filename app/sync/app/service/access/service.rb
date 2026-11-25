# frozen_string_literal: true

module Access
  # Answers whether accounts may perform an action on export rows, using the
  # exports repository scope. System-only; each principal is
  # { account_id:, role_name:, role_scope: }. Only account ids are returned.
  class Service < Verse::Service::Base
    def check(rule:, principals:, action:, resource:, id:)
      auth_context.can!(:check, Resource::Sync::AccessChecks) { |scope| scope.all? { true } }

      raise Verse::Error::ValidationFailed, "unknown rule `#{rule}`" unless rule.to_s == "allowed"
      raise Verse::Error::ValidationFailed, "unknown resource `#{resource}`" unless resource == Resource::Sync::Exports

      principals.map { |principal| principal.to_h.transform_keys(&:to_sym) }.filter_map do |principal|
        context = AuthContextBuilder.build(**principal.slice(:account_id, :role_name, :role_scope))
        principal[:account_id] if allowed?(context, action, id)
      end
    end

    private

    def allowed?(context, action, id)
      Exports::Repository.new(context).scoped(action.to_sym).where(id:).select(1).limit(1).any?
    rescue Verse::Error::Unauthorized
      false
    end
  end
end
