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
end
