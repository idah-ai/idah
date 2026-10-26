# frozen_string_literal: true

class LogsExpo < BaseExpo
  http_path "/logs"

  use_service Log::Service

  desc <<~MD
    Audit logs provide a detailed record of actions and events
    within the system, enhancing transparency and accountability.
  MD

  json_api Log::Record do
    show do
      meta nodoc: true
    end
    index do
      allowed_filters :action__in,
                      :actor_account_id__eq,
                      :actor_account_id__in,
                      :event_timestamp__gte,
                      :event_timestamp__lte,
                      :resource_type__in,
                      :resource_id__match,
                      :actor_account_role_name__nin
      meta nodoc: true
    end
  end

  # rubocop:disable Style/CombinableLoops

  # Account events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Iam::Accounts, event)
    def on_account_event
      log!
    end
  end

  expose on_resource_event(Resource::Iam::Accounts, "logged_in")
  def on_account_logged_in
    log!(
      action: message.content[:metadata][:validation] ? "logged_in" : "failed_log_in_attempt"
    )
  end

  # Account Session events
  %w[logged_out].each do |event|
    expose on_resource_event(Resource::Iam::AccountSessions, event)
    def on_account_session_event
      log!(
        resource_id: message.content[:metadata][:actor_account_email]
      )
    end
  end

  # Organization events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Iam::Organizations, event)
    def on_organization_event
      log!(
        organization_id: message.content[:resource_id]
      )
    end
  end

  # Project events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Dataset::Projects, event)
    def on_project_event
      log!(
        organization_id: message.content[:metadata][:organization_id],
        project_id: message.content[:resource_id]
      )
    end
  end

  # Project Member events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Dataset::ProjectMembers, event)
    def on_project_member_event
      log!(
        project_id: message.content[:metadata][:project_id]
      )
    end
  end

  # Dataset events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Dataset::Datasets, event)
    def on_dataset_event
      log!(
        organization_id: message.content[:metadata][:organization_id],
        project_id: message.content[:metadata][:project_id],
        dataset_id: message.content[:resource_id]
      )
    end
  end

  # Entry events
  %w[created updated deleted assigned unassigned reopened].each do |event|
    expose on_resource_event(Resource::Dataset::Entries, event)
    def on_entry_event
      # Entries updated by a background worker carry no actor; skip them.
      return unless message.content[:metadata][:actor_account_id]

      log!(
        organization_id: message.content[:metadata][:organization_id],
        project_id: message.content[:metadata][:project_id],
        dataset_id: message.content[:metadata][:dataset_id],
        entry_id: message.content[:resource_id]
      )
    end
  end

  expose on_resource_event(Resource::Dataset::Entries, "submitted")
  def on_entry_submitted
    submission_type = message.content[:metadata][:submission_type]

    return unless submission_type # process only actual submission from annotation/review
    return if submission_type == "start" # initial stage of the entry, not an actual submission

    log!(
      action: message.content[:metadata][:submission_type],
      organization_id: message.content[:metadata][:organization_id],
      project_id: message.content[:metadata][:project_id],
      dataset_id: message.content[:metadata][:dataset_id],
      entry_id: message.content[:resource_id]
    )
  end

  # Media events
  %w[created updated deleted].each do |event|
    expose on_resource_event(Resource::Media::Medias, event)
    def on_media_event
      # Medias created by a background worker carry no actor; skip them.
      return unless message.content[:metadata][:actor_account_id]

      log!(
        resource_id: message.content[:metadata][:media_resource]
      )
    end
  end

  # Sync events
  expose on_resource_event(Resource::Sync::Exports, "created")
  def on_exported
    log!(
      action: "exported",
      project_id: message.content[:metadata][:project_id]
    )
  end

  # rubocop:enable Style/CombinableLoops

  private

  # Single entry point for writing an audit log. A single event without an actor
  # must never fail the consumer: the audit `logs.actor_account_id` column is NOT
  # NULL, so skip the insert (with a warning) instead of raising. Handlers that
  # must ignore background-worker events (entries, medias) guard on the actor
  # before calling this.
  def log!(**extra)
    unless message.content[:metadata][:actor_account_id]
      Verse.logger&.warn(
        "[audit] skipping log for #{message.event} (resource #{message.content[:resource_id]}): " \
        "no actor_account_id in event metadata"
      )
      return
    end

    service.create(log_attributes(message:, **extra))
  end

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
