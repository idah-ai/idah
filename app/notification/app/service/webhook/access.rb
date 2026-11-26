# frozen_string_literal: true

module Webhook
  # Keeps the webhooks whose owner may receive an event. Owner status comes from
  # IAM; `org` rules are local, other rules are checked by the owning service.
  # A failed service check allows nobody.
  class Access < Verse::Service::Base
    use_system_repo webhooks: Webhook::Repository

    def allowed(subscribed, rule)
      owners = current_owners(subscribed)
      subscribed = subscribed.select { |webhook| active_owner?(webhook, owners) }
      return subscribed if subscribed.empty? || rule.nil?

      allowed_ids = allowed_account_ids(subscribed.map { owners[_1.account_id.to_s] }.uniq, rule)
      subscribed.select { allowed_ids.include?(_1.account_id) }
    end

    private

    def current_owners(subscribed)
      ids = subscribed.map(&:account_id).uniq
      return {} if ids.empty?

      Api[:idah].iam.accounts.index(filter: { id__in: ids }, page: { size: ids.size }).data.to_h do |account|
        [account.id.to_s, account]
      end
    end

    def active_owner?(webhook, owners)
      owner = owners[webhook.account_id.to_s]
      return true if owner&.enabled && owner.role_name == webhook.role_name

      webhooks.update!(webhook.id, { enabled: false })
      false
    end

    def allowed_account_ids(owners, rule)
      return org_members(owners, rule[:organization_ids]) if rule[:rule].to_s == "org"

      check_with_service(owners, rule)
    end

    def org_members(owners, organization_ids)
      ids = organization_ids.map(&:to_s)
      owners.select { |owner| owner.role_name == "admin" || org_scope(owner).intersect?(ids) }.map { _1.id.to_i }
    end

    def check_with_service(owners, rule)
      principals = owners.map do |owner|
        { account_id: owner.id.to_i, role_name: owner.role_name, role_scope: owner.role_scope || {} }
      end

      Api[:idah].public_send(rule[:service]).access.check(**rule.except(:service).compact, principals:)
    rescue StandardError => e
      Verse.logger&.error { "[WEBHOOK] #{rule[:service]} access check failed: #{e.class}: #{e.message}" }
      []
    end

    def org_scope(owner)
      Array((owner.role_scope || {})[:org] || (owner.role_scope || {})["org"]).map(&:to_s)
    end
  end
end
