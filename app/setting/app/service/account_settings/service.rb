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

    # Create-or-update the current account's setting addressed by its natural
    # key (account_id, key, plugin). account_id is taken from the auth context
    # so callers can only write their own settings. Returns the upserted record.
    def upsert(key, value, plugin: "")
      account_id = auth_context.metadata[:id]
      account_settings.set(key, value, account_id:, plugin:)
      account_settings.index({ account_id:, key:, plugin: }).first
    end

    def delete(account_id)
      settings = account_settings.index({ account_id: })
      settings.each do |setting|
        account_settings.delete(setting.id)
      end
    end
  end
end
