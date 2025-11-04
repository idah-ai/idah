# frozen_string_literal: true

class ProjectMembersExpo < BaseExpo
  http_path "/project_members"

  use_service ProjectMember::Service

  extend Expo::Util::DuplicateFieldHelper

  duplicate "iam:accounts",
            repository_class: ProjectMember::Repository,
            foreign_key: :account_id,
            fields: {
              name: :name,
              email: :email
            }

  json_api ProjectMember::Record, http_opts: { auth: nil } do
    allowed_included "projects"

    index do
      allowed_filters :email__match,
                      :account_id,
                      :role__in,
                      :created_at__gte,
                      :created_at__lte
    end

    show
    create
    update
    delete
  end

  expose on_http(:post, "/authorize_access", auth: nil) do
    desc "Check if context is authorized to do action on resource, based on the allowed access and project memnbership"
    input do
      field :project_id, String
      field :action, String
      field :resource, String
      field :allowed_access, Array, of: String
    end
  end
  def authorize_access
    project_id = params[:project_id]
    action = params[:action].to_sym
    resource = params[:resource]
    allowed_access = params[:allowed_access]

    service.authorize_access(action:, resource:, project_id:, allowed_access:)
  end
end
