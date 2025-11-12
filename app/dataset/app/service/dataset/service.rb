# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository
    use_system project_members: ProjectMember::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      datasets.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      datasets.find!(id, included: included)
    end

    def create(record)
      # Validate required relationships
      unless record.project
        raise Verse::Error::ValidationFailed,
              "project relationship is required to create a dataset"
      end

      # Ensure user can "create" dataset to the project
      unless datasets.account_can_access_project?(record.project.id, :create)
        raise Errors::Service::UnauthorizedProjectAccess
      end

      # Assign attributes
      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = record.project.id
      # attributes[:created_by_email] ||= auth_context.metadata[:email]

      datasets.transaction do
        id = datasets.create(attributes)
        datasets.find(id)
      end
    end

    def update(record)
      datasets.update!(record.id, record.attributes)
      datasets.find!(record.id)
    end

    def delete(id)
      datasets.delete!(id)
    end
  end
end
