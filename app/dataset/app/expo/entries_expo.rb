# frozen_string_literal: true

class EntriesExpo < BaseExpo
  http_path "/entries"

  use_service Entry::Service

  json_api Entry::Record, http_opts: { auth: nil } do
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

  expose on_http(:patch, "/:id/assign", auth: nil) do
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

  expose on_resource_event(Resource::Media::Jobs, "completed")
  def on_job_updated
    job_id = message.content[:resource_id]

    service.mark_entries_as_ready(job_id)
  end

  expose on_resource_event(Resource::Media::Jobs, "created")
  def on_job_created
    job_content = message.content

    job_resource = job_content.dig(:args, 0, :arguments, :resource)
    job_id = job_content[:resource_id]

    return unless job_id && job_resource

    service.update_entries_job(job_id, job_resource)
  end
end
