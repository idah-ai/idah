# frozen_string_literal: true

module Jobs
  class Service < Verse::Service::Base
    use Jobs::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      repo.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      repo.find!(id, included:)
    end

    def delete(id)
      repo.delete(id)
    end

    def create(
      job_class,
      created_by:,
      arguments: {},
      priority: 0,
      scheduled_at: Time.now,
      unicity: nil
    )
      repo.transaction do
        record = {
          job_class: job_class,
          created_by: created_by[:id],
          created_by_role: created_by[:role],
          created_by_organization: created_by[:organization],
          created_by_custom_scopes: created_by[:custom_scopes],
          created_by_metadata: created_by[:metadata],
          arguments:,
          priority:,
          status: "pending",
          scheduled_at:,
          unicity:,
          retry_count: 0,
          progress: 0.0
        }

        record_id = repo.create(record)
        repo.find!(record_id)
      end
    end

    def update(record)
      repo.update!(record.id, record.attributes)
      repo.find!(record.id)
    end
  end
end
