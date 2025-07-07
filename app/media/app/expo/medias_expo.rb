# frozen_string_literal: true

class MediasExpo < BaseExpo
  http_path "/medias"

  use_service Medias::Service

  desc <<-MD
    # Medias Expo

    This exposition provides access to the media records in the system.
  MD

  expose on_http(:get, "info/:resource(/:key)?") do
    desc <<-MD
      ## Get Media Info by ID and Key

      This endpoint retrieves the metadata of a media record by its ID and optional key.
    MD
    input do
      field(:resource, String).meta(description: "The resource ID of the file to get info for")

      # Cannot use default, because variant will be sent as `nil`
      # by Sinatra. Here we transform it to `:original` if it's `nil`.
      field?(:key, [String, NilClass]).transform{ |v| v || "" }.meta(
        description: "The key of the file to get info for;" \
          " optional, default to empty string"
      )
    end
  end
  def info
    service.show(params[:resource], params[:key])
  end

  expose on_http(:get, "files/:resource(/:key)?", renderer: Verse::Http::Renderer::Stream) do
    desc <<-MD
      ## Get Media by ID and Key

      This endpoint retrieves a media record by its ID and optional key.
    MD
    input do
      field(:resource, String).meta(description: "The resource ID of the file to download")

      # Cannot use default, because variant will be sent as `nil`
      # by Sinatra. Here we transform it to `:original` if it's `nil`.
      field?(:key, [String, NilClass]).transform{ |v| v || "" }.meta(
        description: "The key of the file to download;" \
          " optional, default to empty string"
      )
    end
  end
  def download
    media = service.show(params[:resource], params[:key])

    renderer.content_type = media.mime_type
    server.response.headers["Content-Length"] = media.size

    media.open
  end

  expose on_http(:post, "files/:resource(/:key)?") do
    desc <<-MD
      ## Upload Media

      This endpoint allows you to upload a media file.
      It expect form-data with a file field named `media`.
    MD
    input do
      field(:file, Verse::Http::UploadedFile).meta(desc: "The media to upload")

      field :resource, String
      field(:key, [String, NilClass]).transform { |v| v || "" }.meta(
        desc: "The key of the media; optional, default to empty string"
      )
    end
    output Verse::JsonApi::Util.jsonapi_record(
      Medias::Record
    )
  end
  def upload
    service.upload(
      params[:file],
      resource: params[:resource],
      key: params[:key]
    )
  end
end
