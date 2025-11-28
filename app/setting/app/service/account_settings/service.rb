# frozen_string_literal: true

module AccountSettings
  class Service < Verse::Service::Base
    use account_settings: AccountSetting::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      account_settings.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      account_settings.find!(id, included: included)
    end

    def create(record)
      account_settings.transaction do
        record_id = account_settings.create(record.attributes)
        account_settings.find!(record_id)
      end
    end

    def update(record)
      account_settings.update!(record.id, record.attributes)
      account_settings.find!(record.id)
    end

    def delete(id)
      account_settings.delete(id)
    end
  end
end
