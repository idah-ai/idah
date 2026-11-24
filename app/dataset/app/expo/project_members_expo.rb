# frozen_string_literal: true

class ProjectMembersExpo < BaseExpo
  http_path "/project_members"

  use_service ProjectMember::Service

  desc <<~MD
    Members are user accounts assigned to projects
    with specific roles for annotation and review work.
  MD

  extend Expo::Util::DuplicateFieldHelper

  duplicate "iam:accounts",
            repository_class: ProjectMember::Repository,
            foreign_key: :account_id,
            fields: {
              name: :name,
              email: :email
            }

  json_api ProjectMember::Record do
    allowed_included "project"

    index do
      allowed_filters :email__match,
                      :project_id,
                      :project_id__in,
                      :account_id,
                      :role__in,
                      :created_at__gte,
                      :created_at__lte,
                      :organization_id__in,
                      :enabled
    end

    show
    update
    delete
  end

  expose on_http(:post, "/invite") do
    desc "Invite members to a project (batch, all-or-nothing)"
    input do
      field :project_id, String
      field :members, Array
    end
  end
  def invite
    service.invite(params[:project_id], members: params[:members])
  end

  expose on_http(:post, "/:id/resend_invitation") do
    desc "Resend a project member invitation (guarded)"
    input do
      field :id, String
    end
  end
  def resend_invitation
    service.resend_invitation(params[:id])
  end

  expose on_resource_event(Resource::Iam::Accounts, "deleted")
  def on_account_deleted
    account_id = message.content[:resource_id]

    service.delete_account_members(account_id, message.content[:metadata])
  end

  expose on_resource_event(Resource::Iam::Accounts, "updated")
  def on_account_updated
    account_id = message.content[:resource_id]
    enabled = message.content.dig(:args, 0, :enabled)

    # Only disable project members if the account is being disabled
    # Ensure enabled param is not nil and is false
    return if enabled.nil? || enabled

    service.disable_account_members(account_id, message.content[:metadata])
  end
end
