# frozen_string_literal: true

module Organization
  class Service < Verse::Service::Base
    use organizations: Organization::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      organizations.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      organizations.find!(id, included: included)
    end

    def create(record)
      organizations.transaction do
        record_id = organizations.create(record.attributes)
        organizations.find!(record_id)
      end
    end

    def update(record)
      organizations.update!(record.id, record.attributes)
      organizations.find!(record.id)
    end

    def delete(id)
      # This check guards a destructive action, so it must read live data: bypass
      # the cached ProjectMembership::Lookup (whose TTL could leave a stale
      # "no projects" answer for up to 5 minutes) and query the dataset service
      # directly. index_all, not the paginated index, so orgs with many projects
      # are not under-counted.
      projects = Api[:idah].dataset.projects.index_all(
        filter: { organization_id: id },
        fields: { Resource::Dataset::Projects => %w[id] }
      )
      unless projects.empty?
        raise Verse::Error::Unauthorized, "Unable to delete organization that still has project(s)"
      end

      organizations.delete!(id)
    end
  end
end
