# frozen_string_literal: true

class ProjectsExpo < BaseExpo
  http_path "/projects"

  use_service Project::Service

  json_api Project::Record, http_opts: { auth: nil } do
    show
    index
    create
    update
    delete
  end
end
