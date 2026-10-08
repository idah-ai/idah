# frozen_string_literal: true

module Webhook
  class Service < Verse::Service::Base
    use_repo webhooks: Webhook::Repository

    # Lists the caller's webhooks created under their current role. Webhooks
    # from a previous role stay hidden until the role matches again.
    def index(filter = {}, included: [], page: 1, items_per_page: 100, sort: nil, query_count: false)
      result = webhooks.index(
        { **filter, role_name: current_role },
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )

      Verse::Util::ArrayWithMetadata.new(result.map { mask(_1) }, metadata: result.metadata)
    end

    def show(id, included: [])
      mask(webhooks.find!(id, included:))
    end

    # The only response carrying the full secret.
    def create(record)
      auth_context.reject! unless auth_context.can?(:create, Resource::Notification::Webhooks)

      webhooks.transaction do
        attr = record.attributes.slice(:name, :url, :events, :enabled).compact

        validate_events!(attr[:events])
        UrlValidator.validate!(attr[:url])

        id = webhooks.create(
          {
            **attr,
            account_id: auth_context.metadata[:id],
            role_name: current_role,
            secret: "whsec_#{SecureRandom.hex(32)}"
          }
        )

        webhooks.find!(id)
      end
    end

    # account_id, role_name and secret are immutable.
    def update(record)
      webhooks.transaction do
        attr = record.attributes.slice(:name, :url, :events, :enabled).compact
        webhook = webhooks.find!(record.id)

        validate_events!(attr[:events]) if attr.key?(:events)
        UrlValidator.validate!(attr[:url]) if attr.key?(:url)

        if attr[:enabled] && webhook.role_name != current_role
          raise Verse::Error::ValidationFailed,
                "webhook was created with role `#{webhook.role_name}` and cannot be enabled with your current role"
        end

        webhooks.update!(record.id, attr)
        mask(webhooks.find!(record.id))
      end
    end

    def delete(id)
      webhooks.transaction do
        webhooks.delete!(id)
      end
    end

    def events
      auth_context.reject! unless auth_context.can?(:read, Resource::Notification::Webhooks)

      auth_context.mark_as_checked!

      Handlers.allowed_for(current_role).map do |handler|
        EventRecord.new(
          {
            id: handler.id,
            event: handler.event,
            label: handler.label,
            description: handler.desc,
            allowed_roles: handler.allowed_roles
          }
        )
      end
    end

    private

    def current_role = auth_context.role.to_s

    def validate_events!(events)
      if !events.is_a?(Array) || events.empty?
        raise Verse::Error::ValidationFailed, "events must be a non-empty list"
      end

      unknown = events - Handlers.allowed_for(current_role).map(&:id)
      return if unknown.empty?

      raise Verse::Error::ValidationFailed, "unknown or not allowed events: #{unknown.join(", ")}"
    end

    def mask(webhook)
      secret = webhook.secret
      Record.new({ **webhook.fields, secret: "#{secret[0..9]}...#{secret[-4..]}" })
    end
  end
end
