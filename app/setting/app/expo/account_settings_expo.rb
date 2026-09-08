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
  end

  # Create-or-update by natural key (account_id, key, plugin). Replaces the
  # REST update-by-id path: every write goes through this single upsert, so new
  # settings need no backfill — a row is created on first write, updated after.
  # account_id is derived from the auth context, never the request body.
  expose on_http(:post, "/upsert") do
    desc "Create or update the current account's setting addressed by (key, plugin)."
    input do
      field :data, Hash do
        field(:type, String).rule("type invalid") { |x| x == Resource::Setting::AccountSettings }
        field :attributes, Hash do
          field(:key, String)
          field?(:plugin, String)
          field(:value, [Hash, Array, String, Integer, Float, TrueClass, FalseClass, NilClass])
        end
      end
    end
    output Verse::JsonApi::Util.jsonapi_record(AccountSetting::Record)
  end
  def upsert
    attributes = params.dig(:data, :attributes)
    service.upsert(
      attributes[:key],
      attributes[:value],
      plugin: attributes[:plugin] || ""
    )
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
