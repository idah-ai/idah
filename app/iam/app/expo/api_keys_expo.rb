# frozen_string_literal: true

class ApiKeysExpo < BaseExpo
  http_path "/api_keys"

  use_service ApiKey::Service

  json_api ApiKey::Record do
    index do
      allowed_filters :name__match
    end

    show
    create
    update
    delete
  end

  expose on_http(:get, "/permissions") do
    desc <<-MD
      List all existing permissions used when generating an
      API key. Based on the role used to generate the key,
      some permissions may be unavailable.
    MD
  end
  def permissions
    service.show_permissions
  end

  expose on_http(:post, "/:id/revoke") do
    desc <<-MD
      Revoke an API key.
    MD
    input do
      field :id, String
    end
  end
  def revoke
    service.revoke(params[:id])
  end
end
