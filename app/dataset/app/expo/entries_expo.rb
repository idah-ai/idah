# frozen_string_literal: true

class EntriesExpo < BaseExpo
  http_path "/entries"

  use_service Entry::Service

  desc <<~MD
    Entries represent individual data items within a dataset
    that can be assigned, annotated, and tracked through workflow stages.
  MD

  json_api Entry::Record do
    allowed_included "dataset", "dataset.project", "assigned_to", "submitted_by", "reviewed_by"
    show
    index do
      allowed_filters :resource__match,
                      :status__in,
                      :priority__in,
                      :assigned_to_id,
                      :assigned_to_id__eq,
                      :assigned_to_id__in,
                      :wf_step__in,
                      :participated
    end
    create do
      authorized_relationships dataset: [:link]
    end
    update
    delete
  end

  expose on_http(:patch, "/:id/assign") do
    desc "Assign a project member to an entry"
    input do
      field :id, String
      field :data, Hash do
        field :attributes, Hash do
          field :assigned_to_id, Integer
        end
      end
    end

    output Verse::JsonApi::Util.jsonapi_record(Entry::Record)
  end
  def assign
    id = params[:id]
    member_id = params.dig(:data, :attributes, :assigned_to_id)

    service.assign_member(id, member_id)
  end

  expose on_http(:get, "/:id/select") do
    desc "Select workflow event for an entry"
    input do
      field :id, String
    end

    output Verse::JsonApi::Util.jsonapi_record(Entry::Record)
  end
  def select
    entry_id = params[:id]

    service.select(entry_id)
  end

  expose on_http(:post, "/:id/submit") do
    desc "Submit workflow event for an entry"
    input do
      field :id, String
      field? :data, Hash do
        field? :attributes, Hash
      end
    end

    output Verse::JsonApi::Util.jsonapi_record(Entry::Record)
  end

  def submit
    entry_id = params[:id]
    opts = params.dig(:data, :attributes) || {}

    service.submit(entry_id, **opts)
  end

  expose on_http(:post, "/:id/error") do
    desc "Trigger error event for an entry"
    input do
      field :id, String
      field :data, Hash do
        field :attributes, Hash do
          field :message, String
        end
      end
    end

    output Verse::JsonApi::Util.jsonapi_record(Entry::Record)
  end
  def error
    entry_id = params[:id]
    opts = params.dig(:data, :attributes) || {}

    service.error(entry_id, **opts)
  end

  expose on_resource_event(Resource::Media::Jobs, "completed")
  def on_job_completed
    job_id = message.content[:resource_id]

    service.mark_entries_status_as(job_id, "ready")
  end

  expose on_resource_event(Resource::Media::Jobs, "errored")
  def on_job_errored
    job_id = message.content[:resource_id]

    service.mark_entries_status_as(job_id, "processing_error")
  end

  expose on_resource_event(Resource::Dataset::ProjectMembers, "updated")
  def on_project_member_disabled
    account_id = message.content.dig(:metadata, :project_member_account_id)
    project_id = message.content.dig(:metadata, :project_id)

    # Only unassign entries if the project member is being disabled
    return if message.content.dig(:args, 0, :disabled_at).nil?

    service.unassign_account_entries(account_id, project_id)
  end

  expose on_resource_event(Resource::Dataset::Datasets, "duplicated")
  def on_dataset_duplicated
    dataset_id = params[:resource_id]
    arg = params[:args].first
    duping_dataset_id = arg[:duping_dataset_id]
    entry_ids = arg[:entry_ids]
    with_annotations = arg[:with_annotations]

    service.duplicate_entries(dataset_id, duping_dataset_id:, entry_ids:, with_annotations:)
  end
end
