require "open3"

module Jobs
  class VideoProcessing < Base

    def fetch_information(file_stream)
      # Get framerate
      "ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0"

      Executor.instance.call(
        "ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0"
      ) do |stdin, stdout, stderr, wait_thr|
        if wait_thr.value.success?
          output = stdout.read.strip
          width, height, r_frame_rate, duration = output.split(",")
          {
            width: width.to_i,
            height: height.to_i,
            frame_rate: r_frame_rate,
            duration: duration.to_f
          }
        else
          raise "Failed to fetch video information: #{stderr.read.strip}"
        end
      rescue StandardError => e
        raise "Error processing video file: #{e.message}"
      end
    end

    def perform(file_id:)

    end

  end
end