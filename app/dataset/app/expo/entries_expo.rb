# frozen_string_literal: true

class EntriesExpo < BaseExpo
  http_path "/entries"

  use_service Entry::Service

  json_api Entry::Record do
    allowed_included "dataset", "dataset.project"
    show
    index do
      allowed_filters :status__in,
                      :priority__in,
                      :assigned_to_id,
                      :assigned_to_id__eq,
                      :assigned_to_id__in,
                      :wf_step__in
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
  end
  def assign_member
    id = params[:id]
    member_id = params.dig(:data, :attributes, :assigned_to_id)

    service.assign_member(id, member_id)
  end

  expose on_http(:post, "/:id/submit") do
    desc "Submit workflow event for an entry"
    input do
      field :id, String
      field? :data, Hash do
        field? :attributes, Hash
      end
    end
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
  end
  def error
    entry_id = params[:id]
    opts = params.dig(:data, :attributes) || {}

    service.error(entry_id, **opts)
  end

  expose on_resource_event(Resource::Media::Jobs, "completed")
  def on_job_updated
    job_id = message.content[:resource_id]

    service.mark_entries_as_ready(job_id)
  end
end
