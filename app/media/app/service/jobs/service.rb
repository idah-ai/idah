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

    def create(record)
      repo.transaction do
        record_id = repo.create(record.attributes)
        repo.find!(record_id)
      end
    end

    def update(record)
      repo.update!(record.id, record.attributes)
      repo.find!(record.id)
    end
  end
end
