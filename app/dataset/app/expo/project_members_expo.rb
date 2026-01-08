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

  json_api ProjectMember::Record do
    allowed_included "project"

    index do
      allowed_filters :email__match,
                      :project_id,
                      :account_id,
                      :role__in,
                      :created_at__gte,
                      :created_at__lte,
                      :organization_id__in,
                      :enabled
    end

    show
    create do
      authorized_relationships project: [:link]
    end
    update
    delete
  end

  expose on_resource_event(Resource::Iam::Accounts, "deleted")
  def on_account_deleted
    account_id = message.content[:resource_id]

    service.delete_account_members(account_id)
  end

  expose on_resource_event(Resource::Iam::Accounts, "updated")
  def on_account_updated
    account_id = message.content[:resource_id]

    # Only disable project members if the account is being disabled
    return if message.content.dig(:args, 0, :enabled) || true

    service.disable_account_members(account_id)
  end
end
