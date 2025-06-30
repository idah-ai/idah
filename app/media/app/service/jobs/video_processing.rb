# frozen_string_literal: true

require "open3"

module Jobs
  class VideoProcessing < Base
    def fetch_information(_file_stream)
      # Get framerate

      Executor.instance.call(
        "ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0"
      ) do |_stdin, stdout, stderr, wait_thr|
        raise "Failed to fetch video information: #{stderr.read.strip}" unless wait_thr.value.success?

        output = stdout.read.strip
        width, height, r_frame_rate, duration = output.split(",")
        {
          width: width.to_i,
          height: height.to_i,
          frame_rate: r_frame_rate,
          duration: duration.to_f
        }
      rescue StandardError => e
        raise "Error processing video file: #{e.message}"
      end
    end

    def perform(file_id:); end
  end
end
