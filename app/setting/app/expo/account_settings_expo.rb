# frozen_string_literal: true

class AccountSettingsExpo < BaseExpo
  http_path "/account_settings"

  use_service AccountSettings::Service

  desc <<~MD
    Manage account settings for user preferences and configurations,
    including retrieval and updating of settings.
  MD

  json_api AccountSetting::Record do
    show
    index do
      allowed_filters :account_id,
                      :key
    end

    update
  end

  expose on_resource_event(Resource::Iam::Accounts, "created")
  def create_account_settings
    service.create(params[:resource_id])
  end

  expose on_resource_event(Resource::Iam::Accounts, "deleted")
  def delete_account_settings
    service.delete(params[:resource_id])
  end
end
