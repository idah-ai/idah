# frozen_string_literal: true

class ProjectsExpo < BaseExpo
  http_path "/projects"

  use_service Project::Service

  desc <<~MD
    Projects organize datasets and team members
    for collaborative data annotation work.
  MD

  json_api Project::Record do
    # The project's storage target (name and location, never credentials) goes
    # in the response meta, for every member to see where the files are.
    show do
      body do |service, default|
        project = default.call
        storage_target = service.storage_target_summary(project)
        renderer.meta = { storage_target: } if storage_target
        project
      end
    end
    index do
      allowed_filters :created_by_email__match,
                      :created_at__gte,
                      :created_at__lte,
                      :organization_id,
                      :organization_id__in,
                      :updated_at__gte,
                      :updated_at__lte,
                      :name__match
    end

    create
    update
    delete
  end
end
