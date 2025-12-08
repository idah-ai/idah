# frozen_string_literal: true

class AccountSettingsExpo < BaseExpo
  http_path "/account_settings"

  use_service AccountSettings::Service

  json_api AccountSetting::Record do
    show
    index do
      allowed_filters :account_id,
                      :key
    end

    update
  end

  expose on_resource_event("iam:accounts", "created")
  def create_account_settings
    service.create(params[:resource_id])
  end

  expose on_resource_event("iam:accounts", "deleted")
  def delete_account_settings
    service.delete(params[:resource_id])
  end
end
