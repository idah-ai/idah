class VideosExpo < BaseExpo
  http_path "/videos"

  use_service Video::Service

  expose on_http(:post, "process") do
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
    service.process(
      params[:data]
    )
  end
end