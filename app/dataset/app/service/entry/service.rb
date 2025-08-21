# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository

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
        job_id = attr[:job_id]

        attr[:status] = if job_id
                          "pending"
                        else
                          "ready"
                        end

        if record.dataset
          attr[:dataset_id] = record.dataset.id
        else
          raise Verse::Error::ValidationFailed,
                "dataset is required to create a dataset"
        end

        id = entries.create(attr)

        if job_id
          # After we created, we check the job status
          # and update the entry status accordingly.
          # If the job is not done yet, we will update the
          # status on event.
          entries.after_commit do
            job = Api[:idah].media.jobs.show(id: job_id)

            if job.status == "done"
              entries.update!(id, {status: "ready"})
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
      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      entries.delete(id)
    end
  end
end
