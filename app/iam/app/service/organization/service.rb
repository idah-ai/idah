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
      projects = Api[:idah].dataset.projects.index(filter: { organization_id: id }).data
      raise Verse::Error::Unauthorized, "Unable to delete organization that still has project(s)" unless projects.empty?

      organizations.delete(id)
    end
  end
end
