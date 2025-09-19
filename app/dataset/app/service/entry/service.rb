# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository
    use_system datasets: Dataset::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      entries.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      entries.find!(id, included: included)
    end

    def create(record)
      attr = record.attributes

      attr[:id] = record.id || UUIDv7.generate

      entries.transaction do
        if entries.find_by({ resource: attr[:resource] })
          raise Verse::Error::ValidationFailed,
                "Entry with resource #{attr[:resource]} already exists"
        end

        unless record.dataset
          raise Verse::Error::ValidationFailed,
                "dataset is required to create an entry"
        end

        attr[:dataset_id] = record.dataset.id
        job_id = attr[:job_id]

        attr[:status] ||= job_id ? "pending" : "ready"

        id = entries.create(attr)

        entry = entries.find!(id)

        if job_id
          # After we created, we check the job status
          # and update the entry status accordingly.
          # If the job is not done yet, we will update the
          # status on event.
          entries.after_commit do
            job = Api[:idah].media.jobs.show(id: job_id)

            if job.status == "completed"
              entries.update!(id, { status: "ready" })
            end
          end
        else
          # If there is no job, we can start processing right away
          # depending on the dataset modality
          entry_dataset_modality = datasets.find!(entry.dataset_id).modality

          if entry_dataset_modality == "video"
            Api[:idah].media.videos.process(
              attributes: {
                resource: entry.resource,
                sizes: ["240p", "360p", "480p", "720p", "1080p", "1440p", "2160p"],
                generate_frames: false,
                generate_thumbnail: true,
                generate_frame_format: "avif",
                generate_frame_framerate: 6,
                streaming_time_per_segment: 10
              }
            )
          end
        end

        entry
      end
    end

    def mark_entries_as_ready(job_id)
      entries.mark_entries_as_ready(job_id)
    end

    def update(record)
      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      entries.delete(id)
    end

    def update_entries_job(job_id, resource)
      entries.transaction do
        entry = entries.find_by({ resource: })

        raise Verse::Error::NotFound, "Entry with resource #{resource} not found" unless entry

        if entry.job_id && entry.job_id != job_id
          raise Verse::Error::ValidationFailed,
                "Entry with resource #{resource} already has a different job_id #{entry.job_id}"
        end

        entries.update!(entry.id, { job_id: })
        entries.find!(entry.id)
      end
    end

    def assign_member(id, project_member_id)
      entries.transaction do
        entries.update!(id, { assigned_to_id: project_member_id })
        entries.find!(id)
      end
    end
  end
end
