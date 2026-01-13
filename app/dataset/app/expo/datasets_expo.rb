# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service Dataset::Service

  json_api Dataset::Record do
    allowed_included "entries", "project"

    show
    index do
      allowed_filters :id__in,
                      :project_id__in,
                      :name__match,
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

  expose on_resource_event(Resource::Dataset::Datasets, "completed")
  def on_dataset_completed
    dataset_id = message.content[:resource_id]

    service.notify_dataset_completed(dataset_id)
  end
end
