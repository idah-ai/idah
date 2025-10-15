# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository

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
      # TODO: remove mocking
      account_id = auth_context.metadata[:id] || 1
      if record.project
        project_id = record.project.id
      else
        raise Verse::Error::ValidationFailed,
              "project is required to create a dataset"
      end
      role = ProjectMember::Repository.new(auth_context).get_permission_set(account_id, project_id)

      auth_context.reject! unless auth_context.can!(:create, Resource::Dataset::Datasets) do |scope|
        scope.all? { true }
        scope.as_user? { owner?(role) || annotator?(role) }
      end

      attr = record.attributes
      attr[:id] = record.id || UUIDv7.generate
      attr[:created_by_id] = account_id
      attr[:project_id] = project_id

      if record.project
        attr[:project_id] = project_id
      else
        raise Verse::Error::ValidationFailed,
              "project is required to create a dataset"
      end

      id = datasets.create(**record.attributes)

      datasets.find!(id)
    end

    def update(record)
      datasets.update!(record.id, record.attributes)
      datasets.find!(record.id)
    end

    def delete(id)
      datasets.delete(id)
    end
  end
end
