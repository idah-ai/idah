# frozen_string_literal: true

class LogsExpo < BaseExpo
  http_path "/logs"

  use_service Log::Service

  json_api Log::Record do
    show
    index
  end

  def create_audit_log
    service.create(message)
  end

  # resources we want to include in Audit Logs
  # TODO: complete this list and refactor/regex somehow ?
  %w[
    iam:accounts
    dataset:projects
    dataset:project_members
    dataset:datasets
    dataset:entries
  ].each do |resource|
    # events/actions we want to include in Audit Logs
    %w[created updated deleted].each do |event|
      attach_exposition(
        :create_audit_log,
        build_expose(on_resource_event(resource, event))
      )
    end
  end

  %w[assigned unassigned submitted].each do |event|
    attach_exposition(
      :create_audit_log,
      build_expose(on_resource_event("dataset:entries", event))
    )
  end
end
