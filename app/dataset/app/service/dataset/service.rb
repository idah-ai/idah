# frozen_string_literal: true

module Dataset
  class Service < Verse::Service::Base
    use datasets: Dataset::Repository,
        members: ProjectMember::Repository

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
      account_id = auth_context.metadata[:id]
      if record.project
        project_id = record.project.id
      else
        raise Verse::Error::ValidationFailed,
              "project is required to create a dataset"
      end

      members.authorize_action(
        action: :create,
        resource: Resource::Dataset::Datasets,
        account_id:,
        project_id:,
        allowed_access: [:org_owner, :owner]
      )

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
      account_id = auth_context.metadata[:id]
      project_id = datasets.find!(record.id).project_id

      members.authorize_action(
        action: :update,
        resource: Resource::Dataset::Datasets,
        account_id:,
        project_id:,
        allowed_access: [:org_owner, :owner]
      )

      datasets.update!(record.id, record.attributes)
      datasets.find!(record.id)
    end

    def delete(id)
      account_id = auth_context.metadata[:id]
      project_id = datasets.find!(id).project_id

      members.authorize_action(
        action: :delete,
        resource: Resource::Dataset::Datasets,
        account_id:,
        project_id:,
        allowed_access: [:org_owner, :owner]
      )

      datasets.delete(id)
    end
  end
end
