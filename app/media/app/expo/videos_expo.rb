# frozen_string_literal: true

class VideosExpo < BaseExpo
  http_path "/videos"

  use_service Video::Service

  expose on_http(:post, "process", auth: nil) do
    desc <<-MD
      ## Process Video

      This endpoint processes a video file by creating a job that will handle
      the video processing asynchronously.
    MD
    input do
      field(:data, Video::ArgumentsSchema).meta(
        description: "The arguments for processing the video. See the schema for details."
      )
    end
  end
  def process
    server.response.status = 201

    service.process(
      params[:data]
    )
  end

  expose on_resource_event("media:medias", "created") do
    # Handle the event when a media resource is created
    desc "When a new media is created, start a video processing job if applicable."
  end
  def on_media_created
    media_content = message.content
    # binding.pry
    puts "Media created event received: #{media_content.inspect}"
    media = media_content.dig(:args, 0)
    # Only process video files
    return unless media.mime_type.start_with?("video/")
    puts "New video media created: #{media.inspect}"
    # Start a video processing job
    service.process(
      resource: media.resource,
      key: media.key,
      mime_type: media.mime_type,
      size: media.size,
      # Add any other necessary parameters here
    )
  end
end
