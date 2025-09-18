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

  expose on_resource_event("dataset:entries", "created") do
    # Handle the event when a media resource is created
    desc "When a new entry is created, start a video processing job if applicable."
  end
  def on_entries_created
    entry_content = message.content
    entry = entry_content.dig(:args, 0)
    media_resource = entry[:resource]

    return unless media_resource

    # Only process video files
    # return unless entry.mime_type.start_with?("video/")
    # Start a video processing job
    service.process(
      resource: media_resource,
    )
  end
end
