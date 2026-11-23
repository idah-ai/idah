# frozen_string_literal: true

# Single entry point for project-membership data used by services other than
# dataset (iam, media, sync) to scope their own repositories.
#
# The lookup is deliberately stateless: it always queries the dataset service
# through the inter-service API client with `index_all` + `filter:` + minimal
# `fields`. The in-memory cache is layered behind this class without changing
# any caller.
module ProjectMembership
  class Lookup
    # A single enabled membership, with the project's organization id resolved
    # server-side so callers never need to query projects separately.
    Membership = Struct.new(:project_id, :role, :organization_id, keyword_init: true)

    # The cache store. Defaults to the process-wide `ProjectMembership::Cache`;
    # specs inject a dedicated instance. Callers never change.
    attr_writer :cache

    def cache
      @cache ||= ProjectMembership::Cache.instance
    end

    # The enabled memberships of an account: [{ project_id, role, organization_id }].
    def memberships_for(account_id)
      cache.fetch(Cache::MEMBERSHIPS_KEY, account_id) do
        memberships = dataset.project_members.index_all(
          filter: { account_id:, enabled: true },
          fields: { Resource::Dataset::ProjectMembers => %w[project_id role] },
          included: ["project"]
        )

        memberships.filter_map do |pm|
          next unless pm.project

          Membership.new(
            project_id: pm.project_id,
            role: pm.role,
            organization_id: pm.project.organization_id
          )
        end
      end
    end

    # Enabled members' account ids across the given projects, or across the
    # projects of the given organizations. Exactly one of the keywords must be
    # provided. Multi-id calls are composed from per-id cached entries so one
    # invalidation never leaves a stale aggregate.
    def member_account_ids(project_ids: nil, organization_ids: nil)
      if project_ids
        ids = Array(project_ids).map(&:to_s)
        return [] if ids.empty?

        ids.flat_map { |id| member_account_ids_for_project(id) }.uniq
      else
        ids = Array(organization_ids).map(&:to_s)
        return [] if ids.empty?

        ids.flat_map { |id| member_account_ids_for_organization(id) }.uniq
      end
    end

    # The ids of the projects belonging to the given organizations.
    def project_ids_for_organizations(org_ids)
      ids = Array(org_ids).map(&:to_s)
      return [] if ids.empty?

      ids.flat_map { |id| project_ids_for_organization(id) }.uniq
    end

    private

    def member_account_ids_for_project(project_id)
      cache.fetch(Cache::MEMBER_ACCOUNT_IDS_PROJECT_KEY, project_id) do
        dataset.project_members.index_all(
          filter: { project_id__in: [project_id], enabled: true },
          fields: { Resource::Dataset::ProjectMembers => %w[account_id] }
        ).map(&:account_id).uniq
      end
    end

    def member_account_ids_for_organization(org_id)
      cache.fetch(Cache::MEMBER_ACCOUNT_IDS_ORG_KEY, org_id) do
        dataset.project_members.index_all(
          filter: { organization_id__in: [org_id], enabled: true },
          fields: { Resource::Dataset::ProjectMembers => %w[account_id] }
        ).map(&:account_id).uniq
      end
    end

    def project_ids_for_organization(org_id)
      cache.fetch(Cache::PROJECT_IDS_ORG_KEY, org_id) do
        dataset.projects.index_all(
          filter: { organization_id: [org_id] },
          fields: { Resource::Dataset::Projects => %w[id] }
        ).map(&:id).uniq
      end
    end

    def dataset
      Api[:idah].dataset
    end
  end
end