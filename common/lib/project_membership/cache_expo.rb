# frozen_string_literal: true

require_relative "./broadcast_hook"

module ProjectMembership
  # Broadcast-mode exposition that keeps the `ProjectMembership::Cache` in sync
  # with dataset project/member events and iam account events.
  #
  # It only delegates to the cache (Golden Rules); it holds no business logic.
  # Registered in iam, media and sync (the services that serve the cache).
  #
  # Invalidation mapping:
  #   dataset:project_members created/updated/deleted
  #     → invalidate the member's account, the project and the organization
  #   dataset:projects created/updated/deleted
  #     → invalidate the project, its organization and the previous org (if any).
  #       On deleted, also flush the whole memberships family: members were
  #       removed by database cascade without events, and project deletions are
  #       rare, so a family flush is simpler and safer than a reverse index.
  #   iam:accounts deleted, and updated with enabled: false
  #     → invalidate that account
  #
  # Missing metadata → flush the whole cache and log at warn level.
  class CacheExpo < Verse::Exposition::Base
    extend ProjectMembership::BroadcastHook

    expose on_resource_broadcast(Resource::Dataset::ProjectMembers, "created")
    def on_project_member_created
      invalidate_from_member_event
    end

    expose on_resource_broadcast(Resource::Dataset::ProjectMembers, "updated")
    def on_project_member_updated
      invalidate_from_member_event
    end

    expose on_resource_broadcast(Resource::Dataset::ProjectMembers, "deleted")
    def on_project_member_deleted
      invalidate_from_member_event
    end

    expose on_resource_broadcast(Resource::Dataset::Projects, "created")
    def on_project_created
      invalidate_from_project_event
    end

    expose on_resource_broadcast(Resource::Dataset::Projects, "updated")
    def on_project_updated
      invalidate_from_project_event
    end

    expose on_resource_broadcast(Resource::Dataset::Projects, "deleted")
    def on_project_deleted
      invalidate_from_project_event(deleted: true)
    end

    expose on_resource_broadcast(Resource::Iam::Accounts, "deleted")
    def on_account_deleted
      invalidate_account_from_event
    end

    expose on_resource_broadcast(Resource::Iam::Accounts, "updated")
    def on_account_updated
      # Only invalidate when the account is being disabled.
      enabled = message.content.dig(:args, 0, :enabled)
      return if enabled.nil? || enabled

      invalidate_account_from_event
    end

    private

    def invalidate_from_member_event
      meta = message.content[:metadata] || {}
      account_id = meta[:project_member_account_id]
      project_id = meta[:project_id]
      org_id = meta[:organization_id]

      if account_id.nil? && project_id.nil? && org_id.nil?
        return flush_and_warn("project_members #{event_name} without invalidation metadata")
      end

      ProjectMembership::Cache.instance.invalidate_account(account_id) if account_id
      ProjectMembership::Cache.instance.invalidate_project(project_id, organization_id: org_id) if project_id
      ProjectMembership::Cache.instance.invalidate_organization(org_id) if org_id
    end

    def invalidate_from_project_event(deleted: false)
      meta = message.content[:metadata] || {}
      project_id = meta[:project_id] || message.content[:resource_id]
      org_id = meta[:organization_id]
      previous_org_id = meta[:previous_organization_id]

      if project_id.nil? && org_id.nil? && previous_org_id.nil?
        return flush_and_warn("projects #{event_name} without invalidation metadata")
      end

      ProjectMembership::Cache.instance.invalidate_project(project_id, organization_id: org_id) if project_id
      ProjectMembership::Cache.instance.invalidate_organization(org_id) if org_id
      ProjectMembership::Cache.instance.invalidate_organization(previous_org_id) if previous_org_id

      # A project move changes which organization its members' cached memberships
      # embed (memberships carry organization_id), so flush the whole memberships
      # family. Project deletion cascades project_members at the DB level (no
      # member events), so it also flushes the memberships family.
      ProjectMembership::Cache.instance.flush! if deleted || previous_org_id
    end

    def invalidate_account_from_event
      account_id = message.content[:resource_id]
      return flush_and_warn("accounts #{event_name} without resource_id") if account_id.nil?

      ProjectMembership::Cache.instance.invalidate_account(account_id)
    end

    def flush_and_warn(reason)
      Verse.logger&.warn { "ProjectMembership cache: flushing whole cache (#{reason})" }
      ProjectMembership::Cache.instance.flush!
    end

    def event_name
      message.headers[:event] || current_action
    end
  end
end