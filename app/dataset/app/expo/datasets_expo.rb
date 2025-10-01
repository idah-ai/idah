# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service Dataset::Service

  json_api Dataset::Record, http_opts: { auth: nil } do
    allowed_included "entries", "project"

    show
    index do
      allowed_filters :name__match,
                      :status__in,
                      :progress__gte,
                      :progress__lte,
                      :modality__in,
                      :created_at__gte,
                      :created_at__lte,
                      :updated_at__gte,
                      :updated_at__lte
    end

    create do
      authorized_relationships project: [:link]
    end
    update
    delete
  end
end
