# frozen_string_literal: true

class DatasetsExpo < BaseExpo
  http_path "/datasets"

  use_service \
    service: Dataset::Service,
    datset_service: Datset::Service

  json_api Dataset::Record, http_opts: { auth: nil } do
    allowed_included "entries"

    show
    index
    create do
      authorized_relationships project: [:link]
    end
    update
    delete
  end

  # # TODO: handle auth ?
  # # import dataset(s) with .datset file
  # expose on_http(:post, "/import", auth: nil) do
  #   desc "Import dataset(s) with uploaded .datset file"
  #   input do
  #     field :resource, String
  #     field :project_id, String
  #   end
  # end
  # def import
  #   binding.pry
  #   datset_service.import(resource: params[:resource], project_id: params[:project_id])
  # end

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

  expose on_http(:get, "/export/:dataset_id", auth: nil) do
    desc <<-MD
    MD
    input do
      field(:dataset_id, String)
    end
  end
  def export
    datset_service.export(params[:dataset_id])

    # TODO: properly handling response output
    server.status 200
  end
end
