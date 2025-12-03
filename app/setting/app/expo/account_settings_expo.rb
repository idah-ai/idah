# frozen_string_literal: true

class AccountSettingsExpo < BaseExpo
  http_path "/account_settings"

  use_service AccountSettings::Service

  json_api AccountSetting::Record do
    show
    index do
      allowed_filters :key
    end

    create
    update
    delete
  end
end
