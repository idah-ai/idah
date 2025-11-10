# frozen_string_literal: true

class OrganizationsExpo < BaseExpo
  http_path "/organizations"

  use_service Organization::Service

  json_api Organization::Record do
    index
    show
    create
    update
    delete
  end
end
