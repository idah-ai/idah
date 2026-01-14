# frozen_string_literal: true

class ProjectsExpo < BaseExpo
  http_path "/projects"

  use_service Project::Service

  json_api Project::Record do
    show
    index do
      allowed_filters :id__in,
                      :created_by_email__match,
                      :created_at__gte,
                      :created_at__lte,
                      :organization_id,
                      :organization_id__in,
                      :updated_at__gte,
                      :updated_at__lte
    end

    create
    update
    delete
  end
end
