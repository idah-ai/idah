# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository,
        dataset_service: Dataset::Service,
        members: ProjectMember::Repository
    use_system datasets: Dataset::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      entries.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      entries.find!(id, included:)
    end

    def create(record)
      # TODO: remove mockings
      account_id = auth_context.metadata[:id] || 1
      if record.dataset
        project_id = dataset_service.show(record.dataset.id).project_id
      else
        raise Verse::Error::ValidationFailed,
              "dataset is required to create an entry"
      end

      members.authorize_action(
        action: :create,
        resource: Resource::Dataset::Entries,
        account_id:,
        project_id:,
        allowed_access: [:owner, :annotator]
      )

      attr = record.attributes
      attr[:id] = record.id || UUIDv7.generate

      entries.transaction do
        unless attr[:resource]
          raise Verse::Error::ValidationFailed,
                "resource is required to create an entry"
        end

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
        # TODO: remove mocking
        attr[:created_by_id] = auth_context.metadata[:id] || 1

        id = entries.create(attr)

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
          entries.after_commit do
            entry_dataset_modality = datasets.find!(record.dataset.id).modality

            if entry_dataset_modality == "video"
              Api[:idah].media.videos.process(
                attributes: {
                  resource: record.resource,
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
        end

        entries.find!(id)
      end
    end

    def mark_entries_as_ready(job_id)
      entries.mark_entries_as_ready(job_id)
    end

    def update(record)
      # TODO: remove mockings
      account_id = auth_context.metadata[:id] || 1
      dataset_id = entries.find!(record.id).dataset_id
      project_id = dataset_service.show(dataset_id).project_id

      members.authorize_action(
        action: :update,
        resource: Resource::Dataset::Entries,
        account_id:,
        project_id:,
        allowed_access: [:owner, :annotator]
      )

      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      # TODO: remove mockings
      account_id = auth_context.metadata[:id] || 1
      dataset_id = entries.find!(id).dataset_id
      project_id = dataset_service.show(dataset_id).project_id

      members.authorize_action(
        action: :delete,
        resource: Resource::Dataset::Entries,
        account_id:,
        project_id:,
        allowed_access: [:owner, :annotator]
      )

      entries.delete(id)
    end

    # TODO: revise action checks for below methods

    def update_entries_job(job_id, resource)
      entries.transaction do
        entry = entries.find_by!({ resource: })

        if entry.job_id && entry.job_id != job_id
          raise Verse::Error::ValidationFailed,
                "Entry with resource #{resource} already has a different job_id #{entry.job_id}"
        end

        entries.update!(entry.id, { job_id: })
        entries.find!(entry.id)
      end
    end

    def assign_member(id, assigned_to_id)
      entries.transaction do
        entries.update!(id, { assigned_to_id: })
        entries.find!(id)
      end
    end

    def submit(entry_id, **opts)
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(entry, **opts)

        entry_workflow.submit!
        entries.update!(
          entry.id,
          {
            wf_step: entry_workflow.aasm.current_state.to_s,
            status: entry_workflow.aasm.current_state == :done ? "completed" : "in_progress"
          }
        )
        entries.find!(entry.id, included: [:dataset])
      end
    end

    def error(entry_id, **opts)
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(entry, **opts)

        entry_workflow.error!
        entries.update!(
          entry.id,
          {
            wf_step: entry_workflow.aasm.current_state.to_s,
            status: "errored"
          }
        )
        entries.find!(entry.id, included: [:dataset])
      end
    end
  end
end
