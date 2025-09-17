# frozen_string_literal: true

class EntriesExpo < BaseExpo
  http_path "/entries"

  use_service Entry::Service

  json_api Entry::Record, http_opts: { auth: nil } do
    show
    index
    create do
      authorized_relationships dataset: [:link]
    end
    update
    delete
  end

  expose on_resource_event("media:jobs", "completed")
  def on_job_updated
    job_id = message.content[:resource_id]

    service.mark_entries_as_ready(job_id)
  end

  expose on_resource_event("media:jobs", "created")
  def on_job_created
    job_content = message.content
    # When a new job is created, we don't need to do anything special.
    # But we can log it or perform other actions if needed.
    puts "Job created: #{job_content} with status #{job_content[:status]}"

    job_resource = job_content.dig(:args, 0, :arguments, :resource)
    job_id = job_content[:resource_id]
    return unless job_id && job_resource

    puts "Creating entry for job #{job_id} and resource #{job_resource}"

    attributes = {
      resource: job_resource,
      job_id: job_id,
    }

    record = Verse::JsonApi::Struct.new(
      {
        type: Resource::Dataset::Entries,
        attributes: attributes,
        relationships: {
          dataset: Verse::JsonApi::Struct.new(
            { type: Resource::Dataset::Datasets, id: UUIDv7.generate }
          ),
        },
      }
    )
    # create a new entry for this job
    service.create(record)
  end
end
