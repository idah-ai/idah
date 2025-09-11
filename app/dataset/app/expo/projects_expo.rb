# frozen_string_literal: true

class ProjectsExpo < BaseExpo
  http_path "/projects"

  use_service Project::Service

  json_api Project::Record, http_opts: { auth: nil } do
    show
    index do
      allowed_filters :name__match, :updated_at__gte, :updated_at__lte
    end

    create
    update
    delete
  end
end
