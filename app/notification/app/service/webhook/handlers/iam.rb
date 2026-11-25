# frozen_string_literal: true

module Webhook
  module Handlers
    # IAM events. Account updates carry the changed fields, and the previous role,
    # scope and enabled flag in metadata.
    module Iam
      module_function

      def account(message)
        { account: Handlers.fetch(:accounts, Handlers.resource_id(message), service: :iam) }
      end

      def role_changed?(message)
        changes = Handlers.changes(message)
        changes.key?(:role_name) && changes[:role_name] != Handlers.metadata(message)[:previous_role_name]
      end

      def org_ids(scope)
        scope = JSON.parse(scope) if scope.is_a?(String)
        Array((scope || {}).to_h.transform_keys(&:to_s)["org"]).map(&:to_s)
      end

      # Organizations the account owned before the update.
      def owned_before(message)
        previous = Handlers.metadata(message)
        return [] unless previous[:previous_role_name] == "org_owner"

        org_ids(previous[:previous_role_scope])
      end

      # Organizations the account owns after the update.
      def owned_after(message)
        changes = Handlers.changes(message)
        previous = Handlers.metadata(message)
        return [] unless (changes[:role_name] || previous[:previous_role_name]) == "org_owner"

        org_ids(changes.fetch(:role_scope) { previous[:previous_role_scope] })
      end

      def added_orgs(message) = owned_after(message) - owned_before(message)

      def removed_orgs(message) = owned_before(message) - owned_after(message)

      Handlers.define "iam.account.created",
                      event: "iam:accounts:created",
                      label: "Account Created",
                      desc: "Triggered when an account is created",
                      allowed_roles: %w[admin],
                      payload: ->(m) { Iam.account(m) }

      Handlers.define "iam.account.disabled",
                      event: "iam:accounts:updated",
                      label: "Account Disabled",
                      desc: "Triggered when an account is disabled",
                      allowed_roles: %w[admin],
                      match: ->(m) {
                        Handlers.changes(m)[:enabled] == false && Handlers.metadata(m)[:previous_enabled] != false
                      },
                      payload: ->(m) { Iam.account(m) }

      Handlers.define "iam.account.enabled",
                      event: "iam:accounts:updated",
                      label: "Account Enabled",
                      desc: "Triggered when an account is enabled",
                      allowed_roles: %w[admin],
                      match: ->(m) {
                        Handlers.changes(m)[:enabled] == true && Handlers.metadata(m)[:previous_enabled] == false
                      },
                      payload: ->(m) { Iam.account(m) }

      Handlers.define "iam.account.role_updated",
                      event: "iam:accounts:updated",
                      label: "Account Role Updated",
                      desc: "Triggered when an account's role changes",
                      allowed_roles: %w[admin],
                      match: ->(m) { Iam.role_changed?(m) },
                      payload: ->(m) {
                        { **Iam.account(m), previous_role_name: Handlers.metadata(m)[:previous_role_name] }
                      }

      Handlers.define "iam.organization.created",
                      event: "iam:organizations:created",
                      label: "Organization Created",
                      desc: "Triggered when an organization is created",
                      allowed_roles: %w[admin],
                      payload: ->(m) {
                        { organization: Handlers.fetch(:organizations, Handlers.resource_id(m), service: :iam) }
                      }

      Handlers.define "iam.organization.deleted",
                      event: "iam:organizations:deleted",
                      label: "Organization Deleted",
                      desc: "Triggered when an organization is deleted",
                      allowed_roles: %w[admin],
                      payload: ->(m) { { organization: { id: Handlers.resource_id(m) } } }

      # Org owners receive these without read access to the account, so only its id is sent.
      Handlers.define "iam.organization.owner.added",
                      event: "iam:accounts:updated",
                      label: "Organization Owner Added",
                      desc: "Triggered when an account becomes owner of an organization",
                      allowed_roles: %w[admin org_owner],
                      match: ->(m) { Iam.added_orgs(m).any? },
                      check: ->(m) { Handlers.org(*Iam.added_orgs(m)) },
                      payload: ->(m) {
                        { account: { id: Handlers.resource_id(m) }, organization_ids: Iam.added_orgs(m) }
                      }

      Handlers.define "iam.organization.owner.removed",
                      event: "iam:accounts:updated",
                      label: "Organization Owner Removed",
                      desc: "Triggered when an account stops being owner of an organization",
                      allowed_roles: %w[admin org_owner],
                      match: ->(m) { Iam.removed_orgs(m).any? },
                      check: ->(m) { Handlers.org(*Iam.removed_orgs(m)) },
                      payload: ->(m) {
                        { account: { id: Handlers.resource_id(m) }, organization_ids: Iam.removed_orgs(m) }
                      }
    end
  end
end
