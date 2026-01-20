# frozen_string_literal: true

class LogsExpo < BaseExpo
  http_path "/logs"

  use_service Log::Service

  json_api Log::Record do
    show
    index do
      allowed_filters :action__in,
                      :actor_account_id__eq,
                      :actor_account_id__in,
                      :event_timestamp__gte,
                      :event_timestamp__lte,
                      :resource_type__in,
                      :resource_id__match,
                      :actor_account_role_name__nin
    end
  end

  DEFAULT_EVENTS = %w[created updated deleted].freeze

  # resource events configuration
  AUDIT_LOG_EVENTS = {
    "iam:accounts" => { extra: %w[logged_in] },
    "iam:organizations" => {},
    "dataset:projects" => {},
    "dataset:project_members" => {},
    "dataset:datasets" => {},
    "dataset:entries" => { extra: %w[assigned unassigned submitted] },
    "media:medias" => {},

    # use 'only:' to skip default events and register a certain list of event
    "iam:account_sessions" => { only: %w[logged_out] }
  }.freeze

  def create_audit_log
    service.create_from_event(message.event, message.content)
  end

  AUDIT_LOG_EVENTS.each do |resource, config|
    events = config[:only] || (DEFAULT_EVENTS + config.fetch(:extra, []))

    events.each do |event|
      attach_exposition(
        :create_audit_log,
        build_expose(on_resource_event(resource, event))
      )
    end
  end
end
