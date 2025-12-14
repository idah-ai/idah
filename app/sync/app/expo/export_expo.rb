# frozen_string_literal: true

class ExportExpo < BaseExpo
  http_path "/export"

  use_service Export::Service

  expose on_http(:get, "", auth: nil) do
    desc "export endpoint"
    input do
      field? :filter do
        field? :datasets do
          field? :id, String
          field? :project_id, String
          field? :modality, String
        end
        field? :entries do
          field? :id, String
        end
        field? :annotations do
          field? :id, String
        end
      end
    end
  end
  def export_dataset
    service.export(Hash(params[:filter]))
  end
end
