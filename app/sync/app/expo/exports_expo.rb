# frozen_string_literal: true

class ExportsExpo < BaseExpo
  http_path "/exports"

  use_service Exports::Service

  desc <<-MD
    # Exports Expo

    This exposition provides access to the export records in the system.
  MD

  json_api Exports::Record do
    allowed_included "job"
    show
    index
    # delete
  end

  expose on_http(:get, "/:id/download", renderer: Verse::Http::Renderer::Stream) do
    desc <<-MD
      ## Get Export by ID

      This endpoint retrieves an export record by its ID.
    MD
  end
  def download
    export = service.show(params[:id])

    renderer.content_type = export.mime_type
    server.response.headers["Content-Disposition"] = "attachment;filename=#{export.filename}"
    server.response.headers["Content-Length"] = export.size

    export.open
  end

    expose on_http(:post, "export") do
    desc "initiate export job generation endpoint"
    input do
      field? :filter do
        field? :organizations do
          field? :id, String
          # field? :name, String
          # [
          #   # any flavored specific organizations attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :projects do
          field? :id, String
          # field? :name, String
          # field? :created_by_email, String
          # [
          #   # any flavored specific projects attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :project_members do
          field? :id, String
          # field? :name, String
          # field? :email, String
          # field? :role, String
          # field? :invited_by_id, String
          # [
          #   # any flavored specific project_members attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :datasets do
          field? :id, String
          field? :id__in, Array, of: String
          # field? :project_id, String
          # field? :modality, String
          # field? :status, String
          # [
          #   # any flavored specific datasets attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        field? :entries do
          field? :id, String
          field? :id__in, Array, of: String
          # field? :wf_step, String
          # field? :status, String
          # field? :resource, String
          # field? :assigned_to_id, String
          # [
          #   # any flavored specific entries attributes
          # ].each do |attribute, type|
          #   field? attribute, type
          # end
        end
        # field? :annotations do
        #   field? :id, String
        #   # # field? :shape_type, String
        #   # [
        #   #   # any flavored specific annotations attributes
        #   # ].each do |attribute, type|
        #   #   field? attribute, type
        #   # end
        # end
        # [
        #   # any flavored specific record
        # ].each do |record|
        #   field? record do
        #     [
        #       # any flavored specific record attributes
        #     ].each do |attribute, type|
        #       field? attribute, type
        #     end
        #   end
        # end
      end
    end
  end
  def export
    service.export(params[:filter])
  end
end
