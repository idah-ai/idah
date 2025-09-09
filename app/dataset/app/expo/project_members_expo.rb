# frozen_string_literal: true

class ProjectMembersExpo < BaseExpo
  http_path "/project_members"

  use_service ProjectMember::Service

  json_api ProjectMember::Record, http_opts: { auth: nil } do
    index do
      allowed_filters :email__match, :role__in, :created_at__gte, :created_at__lte
    end

    show
    create
    update
    delete
  end
end