# frozen_string_literal: true

class EntriesExpo < BaseExpo
  http_path "/entries"

  use_service Entry::Service

  json_api Entry::Record, http_opts: { auth:nil } do
    show
    index
    create do
      authorized_relationships dataset: [:link]
    end
    update
    delete
  end

  expose on_resource_event(Resource::Media::Jobs, :completed)
  def on_job_updated(job)
    job_id = message.content[:resource_id]

    service.update_entry_on_job_completed(job_id)
  end
end
