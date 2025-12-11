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

    def create(account_id)
      Defaults::DEFAULT_ACCOUNT_SETTINGS.each do |key, value|
        account_settings.transaction do
          attributes = {
            account_id:,
            key: key,
            value: value,
          }
          account_settings.create(attributes)
        end
      end
      account_settings.index({ account_id: })
    end

    def update(record)
      account_settings.update!(record.id, record.attributes)
      account_settings.find!(record.id)
    end

    def delete(account_id)
      settings = account_settings.index({ account_id: })
      settings.each do |setting|
        account_settings.delete(setting.id)
      end
    end
  end
end
