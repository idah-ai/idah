# frozen_string_literal: true

module Annotation
  class Service < Verse::Service::Base
    use annotations: Annotation::Repository

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
      # Validate required relationships
      action_label = "create an annotation"
      Validation::Service.require!("project", record.project, action_label)
      Validation::Service.require!("dataset", record.dataset, action_label)
      Validation::Service.require!("entry", record.entry, action_label)

      # Assign attributes
      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = record.project.id
      attributes[:dataset_id] = record.dataset.id
      attributes[:entry_id] = record.entry.id
      attributes[:created_by_email] ||= auth_context.metadata[:email]

      annotations.transaction do
        id = annotations.create(attributes)
        annotations.find!(id)
      end
    end

    def update(record)
      annotations.transaction do
        annotations.update!(record.id, record.attributes)
        annotations.find!(record.id)
      end
    end

    def update_attr(id, attributes)
      annotations.transaction do
        annotations.update!(id, attributes)
        annotations.find!(id)
      end
    end

    def delete(id)
      annotations.delete(id)
    end
  end
end
