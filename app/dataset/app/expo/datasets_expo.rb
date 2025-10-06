# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service \
    service: Dataset::Service,
    datset_service: Datset::Service

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

  expose on_http(:post, "/import", auth: nil) do
    desc <<-MD
    MD
    input do
      field(:file, Verse::Http::UploadedFile).meta(desc: "The .datset file to import")
      field(:project_id, String)
    end
  end
  def import
    datset_service.import(
      file: params[:file],
      project_id: params[:project_id],
    )
  end

  # exporting a dataset, multiple should be possible with different params (project_id ? array of dataset_ids ?)
  expose on_http(:get, "/export/:dataset_id", auth: nil) do
    desc <<-MD
    MD
    input do
      field(:dataset_id, String)
    end
  end
  def export
    datset_service.export(params[:dataset_id])

    # TODO: properly handling export response output
    server.status 200
  end
end
