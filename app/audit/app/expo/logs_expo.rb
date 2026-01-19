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

  def create_audit_log
    service.create_from_event(message.event, message.content)
  end

  # resources we want to include in Audit Logs
  # TODO: complete this list and refactor/regex somehow ?
  %w[
    iam:accounts
    iam:organizations
    dataset:projects
    dataset:project_members
    dataset:datasets
    dataset:entries
    media:medias
  ].each do |resource|
    # events/actions we want to include in Audit Logs
    %w[created updated deleted].each do |event|
      attach_exposition(
        :create_audit_log,
        build_expose(on_resource_event(resource, event))
      )
    end
  end

  %w[logged_in].each do |event|
    attach_exposition(
      :create_audit_log,
      build_expose(on_resource_event("iam:accounts", event))
    )
  end
  %w[logged_out].each do |event|
    attach_exposition(
      :create_audit_log,
      build_expose(on_resource_event("iam:account_sessions", event))
    )
  end

  %w[assigned unassigned submitted].each do |event|
    attach_exposition(
      :create_audit_log,
      build_expose(on_resource_event("dataset:entries", event))
    )
  end
end
