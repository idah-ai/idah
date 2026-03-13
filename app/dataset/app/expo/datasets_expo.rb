# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service Dataset::Service

  json_api Dataset::Record do
    allowed_included "entries", "project"

    show
    index do
      allowed_filters :name__match,
                      :status__in,
                      :progress__gte,
                      :progress__lte,
                      :project_id__eq,
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

  # TODO: TBC; in this case, dataset is duplicating by selecting entry ids
  expose on_http(:post, "/:id/duplicate") do
    desc "Duplicate a dataset and its entries/medias"
    input do
      field :id, String
      field? :entry_ids, Array, of: String
      field? :with_annotations, TrueClass
    end
  end
  def duplicate
    service.duplicate(params[:id], entry_ids: params[:entry_ids], with_annotations: params[:with_annotations])
  end

  expose on_resource_event(Resource::Dataset::Datasets, "completed")
  def on_dataset_completed
    dataset_id = message.content[:resource_id]

    service.notify_dataset_completed(dataset_id)
  end
end
