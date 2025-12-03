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

    DEFAULT_ACCOUNT_SETTINGS = {
      "notification:organization:ownership.assigned": true,
      "notification:organization:ownership.unassigned": true,
      "notification:project:member.invited": true,
      "notification:project:member.removed": true,
      "notification:dataset.completed": true,
    }
    def create(params)
      DEFAULT_ACCOUNT_SETTINGS.each do |key, value|
        account_settings.transaction do
          record = AccountSetting::Record.new({
            account_id: params[:resource_id],
            key: key,
            value: value, 
          })
          account_settings.create(record)
        end
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
