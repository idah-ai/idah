# frozen_string_literal: true

module AccountSession
  class Service < Verse::Service::Base
    use account_sessions: AccountSession::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      account_sessions.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def delete(id)
      account_sessions.delete(id)
    end
  end
end
