# frozen_string_literal: true

class OrganizationsExpo < BaseExpo
  http_path "/organizations"

  use_service Organization::Service

  desc <<~MD
    Manage organizations within the system, including creation,
    updating, retrieval, and deletion.
  MD

  json_api Organization::Record do
    index do
      allowed_filters :name__match,
                      :created_at__gte,
                      :created_at__lte
    end

    show
    create
    update
    delete
  end
end
