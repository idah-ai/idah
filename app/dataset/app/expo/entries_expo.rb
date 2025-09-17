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
                      :wf_step__in
    end
    create do
      authorized_relationships dataset: [:link]
    end
    update
    delete
  end

  expose on_resource_event(Resource::Media::Jobs, :completed)
  def on_job_updated(_job)
    job_id = message.content[:resource_id]

    service.mark_entries_as_ready(job_id)
  end
end
