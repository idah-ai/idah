# fronzen_string_literal: true

module Account
  class Service < Verse::Service::Base
    use accounts: Account::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      accounts.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      accounts.find!(id, included: included)
    end

    def create(record)
      accounts.transaction do
        record_id = accounts.create(record.attributes)
        accounts.find!(record_id)
      end
    end

    def update(record)
      accounts.update!(record.id, record.attributes)
      accounts.find!(record.id)
    end

    def delete(id)
      accounts.delete(id)
    end
  end
end