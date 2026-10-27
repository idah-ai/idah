# frozen_string_literal: true

module Jobs
  class Service < Verse::Service::Base
    use_repo repo: Jobs::Repository

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

    def cleanup
      repo.cleanup
      repo.reclaim_stale
    end
  end
end
