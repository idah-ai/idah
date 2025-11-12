# frozen_string_literal: true

module Annotation
  class Service < Verse::Service::Base
    use annotations: Annotation::Repository, entries: Entry::Repository

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
      unless record.entry
        raise Verse::Error::ValidationFailed,
              "entry relationship is required to create an annotation"
      end

      entry = entries.find!(record.entry.id)

      # Assign attributes
      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = entry.project_id
      attributes[:dataset_id] = entry.dataset_id
      attributes[:entry_id] = entry.id
      attributes[:created_by_email] ||= auth_context.metadata[:email] || "email@example.com"

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
