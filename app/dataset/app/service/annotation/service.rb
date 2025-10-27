# frozen_string_literal: true

module Annotation
  class Service < Verse::Service::Base
    use annotations: Annotation::Repository,
        dataset_service: Dataset::Service,
        entry_service: Entry::Service,
        members: ProjectMember::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      annotations.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      annotations.find!(id, included: included)
    end

    def create(record)
      account_id = auth_context.metadata[:id]
      if record.entry
        dataset_id = entry_service.show(record.entry.id).dataset_id
        project_id = dataset_service.show(dataset_id).project_id
      else
        raise Verse::Error::ValidationFailed,
              "entry is required to create an annotation"
      end

      members.authorize_action(
        action: :create,
        resource: Resource::Dataset::Annotations,
        account_id:,
        project_id:,
        allowed_access: [:org_owner, :owner, :annotator, :reviewer]
      )

      attributes = record.attributes
      attributes[:created_by_id] ||= auth_context.metadata[:id]
      attributes[:id] = record.id || UUIDv7.generate

      if record.entry
        attributes[:entry_id] = record.entry.id
      else
        raise Verse::Error::ValidationFailed,
              "entry relationship is required to create an annotation"
      end

      annotations.transaction do
        id = annotations.create(attributes)
        annotations.find!(id)
      end
    end

    def update(record)
      account_id = auth_context.metadata[:id]
      annotation = annotations.find!(record.id)
      dataset_id = entry_service.show(annotation.entry_id).dataset_id
      project_id = dataset_service.show(dataset_id).project_id

      members.authorize_action(
        action: :update,
        resource: Resource::Dataset::Annotations,
        account_id:,
        project_id:,
        allowed_access: [:org_owner, :owner, :annotator, :reviewer]
      )

      annotations.transaction do
        annotations.update!(record.id, record.attributes)
        annotations.find!(record.id)
      end
    end

    # TODO: recheck how this is used
    def update_attr(id, attributes)
      annotations.transaction do
        annotations.update!(id, attributes)
        annotations.find!(id)
      end
    end

    def delete(id)
      account_id = auth_context.metadata[:id]
      annotation = annotations.find!(id)
      dataset_id = entry_service.show(annotation.entry_id).dataset_id
      project_id = dataset_service.show(dataset_id).project_id

      members.authorize_action(
        action: :delete,
        resource: Resource::Dataset::Annotations,
        account_id:,
        project_id:,
        allowed_access: [:org_owner, :owner, :annotator, :reviewer]
      )

      annotations.delete(id)
    end
  end
end
