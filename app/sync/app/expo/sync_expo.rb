# frozen_string_literal: true

class SyncExpo < BaseExpo
  http_path "/"

  use_service Sync::Service

  expose on_http(:get, "export") do
    desc "export endpoint"
    input do
      field? :filter do
        field? :organizations do
          field? :id, String
          field? :name, String
        end
        field? :projects do
          field? :id, String
          field? :name, String
          field? :created_by_email, String
        end
        field? :project_members do
          field? :id, String
          field? :name, String
          field? :email, String
          field? :role, String
          field? :invited_by_id, String
        end
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
