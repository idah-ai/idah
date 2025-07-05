# frozen_string_literal: true

module Video
  FFPROBE_COMMAND =
    "ffprobe -v quiet -print_format json -show_format -show_streams %<file_path>s"

  VideoInfo = Data.define(
    :width,
    :height,
    :duration,
    :fps,
    :has_audio
  ) do
    def ratio = width.to_f / height

    def self.from_file(file_path)
      json = nil

      begin
        EXECUTOR.call(
          FFPROBE_COMMAND, file_path:
        ) do |_, stdout, _|
          json = stdout.read
        end
      rescue Executor::ExecutionError => e
        raise "Failed to execute ffprobe: #{e.message}"
      end

      json = JSON.parse(json)

      json_streams = json["streams"]&.find{ |stream|
        stream["codec_type"] == "video"
      }

      has_audio = json["streams"]&.any?{ |stream|
        stream["codec_type"] == "audio"
      }

      json_format = json["format"]

      # From fractional to float:
      fps = Rational(json_streams["r_frame_rate"]).to_f
      width = json_streams["width"].to_i
      height = json_streams["height"].to_i
      duration = json_format["duration"].to_f

      VideoInfo.new(
        width:,
        height:,
        duration:,
        fps:,
        has_audio:
      )
    end
  end
end
