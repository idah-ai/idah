# frozen_string_literal: true

class ExportExpo < BaseExpo
  http_path "/export"

  use_service Export::Service

  expose on_http(:post, "/:dataset_id", auth: nil) do
    desc "Export Datasets"
    input do
      field :dataset_id, String
    end
  end
  def export_dataset
    service.export(params[:dataset_id])
  end
end
