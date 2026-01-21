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

  # Account events
  %w[created updated deleted logged_in].each do |event|
    expose on_resource_event(Resource::Iam::Accounts, event)
    def on_account_event
      service.create(log_attributes(message:))
    end
  end

  # Account Session events
  %w[logged_out].each do |event|
    expose on_resource_event(Resource::Iam::AccountSessions, event)
    def on_account_session_event
      service.create(
        log_attributes(
          message:,
          resource_id: message.content[:metadata][:actor_account_email]
        )
      )
    end
  end

  # Organization events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Iam::Organizations, event)
    def on_organization_event
      service.create(
        log_attributes(
          message:,
          organization_id: message.content[:resource_id]
        )
      )
    end
  end

  %w[created updated deleted].each do |event|
    # Project events
    expose on_resource_event(Resource::Dataset::Projects, event)
    def on_project_event
      service.create(
        log_attributes(
          message:,
          organization_id: message.content[:metadata][:organization_id],
          project_id: message.content[:resource_id]
        )
      )
    end

    # Project Member events
    expose on_resource_event(Resource::Dataset::ProjectMembers, event)
    def on_project_member_event
      service.create(
        log_attributes(
          message:,
          project_id: message.content[:metadata][:project_id]
        )
      )
    end

    # Dataset events
    expose on_resource_event(Resource::Dataset::Datasets, event)
    def on_dataset_event
      service.create(
        log_attributes(
          message:,
          organization_id: message.content[:metadata][:organization_id],
          project_id: message.content[:metadata][:project_id],
          dataset_id: message.content[:resource_id]
        )
      )
    end

    # Media events
    expose on_resource_event(Resource::Media::Medias, event)
    def on_media_event
      service.create(
        log_attributes(
          message:,resource_id: message.content[:metadata][:media_resource]
        )
      )
    end
  end

  # Entry events
  %w[created updated deleted assigned unassigned submitted].each do |event|
    expose on_resource_event(Resource::Dataset::Entries, event)
    def on_entry_event
      service.create(
        log_attributes(
          message:,
          organization_id: message.content[:metadata][:organization_id],
          project_id: message.content[:metadata][:project_id],
          dataset_id: message.content[:metadata][:dataset_id],
          entry_id: message.content[:resource_id]
        )
      )
    end
  end

  private

  def log_attributes(message:, **additional_attributes)
    service, type, action = message.event.split(":")
    resource_id = message.content[:resource_id]
    metadata = message.content[:metadata]

    attributes = {
      action: action,
      resource_service: service,
      resource_type: type,
      resource_id:,
      event_timestamp: metadata[:at],
      actor_account_id: metadata[:actor_account_id],
      actor_account_email: metadata&.[](:actor_account_email),
      actor_account_role_name: metadata&.[](:actor_account_role_name),
    }

    attributes.merge(additional_attributes)
  end
end
