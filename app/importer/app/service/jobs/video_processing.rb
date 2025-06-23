require "open3"

module Jobs
  class VideoProcessing < Base

    def fetch_information(file_stream)
      # Get framerate
      "ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0"
    end

    def perform(file_id:)

    end

  end
end