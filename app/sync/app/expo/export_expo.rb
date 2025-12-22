# frozen_string_literal: true

class ExportExpo < BaseExpo
  http_path "/export"

  use_service Export::Service

  expose on_http(:get, "") do
    desc "export endpoint"
    input do
      field? :filter do
        field? :datasets do
          field? :id, String
          field? :project_id, String
          field? :modality, String
          field? :status, String
        end
        field? :entries do
          field? :id, String
          field? :wf_step, String
          field? :status, String
          field? :resource, String
          field? :assigned_to_id, String
        end
        field? :annotations do
          field? :id, String
          # field? :shape_type, String
        end
      end
    end
  end
  def export_dataset
    service.export(params[:filter])
  end
end
