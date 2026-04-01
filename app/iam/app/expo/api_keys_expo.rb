# frozen_string_literal: true

class ApiKeysExpo < BaseExpo
  http_path "/api_keys"

  use_service ApiKey::Service

  json_api ApiKey::Record do
    index do
      allowed_filters :name__match,
                      :expires_at__lte,
                      :expires_at__gte
    end

    show
    create
    update
    delete
  end

  expose on_http(:get, "/permissions(/:scope_type)?") do
    desc <<~MD
      List all existing permissions used when generating an
      API key. Based on the role used to generate the key,
      some permissions may be unavailable.
    MD
    input do
      field?(:scope_type, [String, NilClass]).transform { |v| v || "all" }.meta(
        description: "The scope type to filter permissions; optional, if not provided, defaults to 'all'"
      )
    end
    output Verse::JsonApi::Util.jsonapi_record(ApiPermission::Record)
  end
  def permissions
    service.show_permissions(
      params[:scope_type]
    )
  end

  expose on_http(:post, "/:id/revoke") do
    desc <<~MD
      Revoke an API key.
    MD
    input do
      field :id, String
    end
    output Verse::JsonApi::Util.jsonapi_record(ApiKey::Record)
  end
  def revoke
    service.revoke(params[:id])
  end

  expose on_schedule("15 0 * * *") do
    desc <<~MD
      Daily scheduler to check and update expired API keys status.
      Runs every day at 00:15.
    MD
  end
  def expire_api_keys
    service.expire_api_keys
  end
end
