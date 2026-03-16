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

    index do
      allowed_filters :created_at__gte,
                      :created_at__lte
    end
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
      field :project_id, type: Integer, required: true
      field :dataset_ids, type: Array, required: true
      field :exporter, type: String, required: true
      field :options, type: Hash, required: false, default: { include_medias: "original" }
    end
  end
  def export
    service.create(
      params[:project_id],
      params[:dataset_ids],
      params[:exporter],
      params[:options]
    )
  end

  expose on_http(:get, "/formats", renderer: Verse::Http::Renderer::Json) do
    desc <<-MD
      ## Get Available Export Formats
      #
      # This endpoint retrieves the list of available export formats for the given modalities.
    MD
    input do
      field :modalities, type: Array, required: true
    end
  end
  def formats
    auth_context.can!(:read, Resource::Sync::Exports) do |scope|
      formats = Exports::Registry.list_export_format_details(params[:modalities])

      scope.all? { formats }
      scope.as_org_owner? { formats }
      scope.as_user? { formats }
    end
  end
end
