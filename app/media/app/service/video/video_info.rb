module Video

  FFPROBE_COMMAND =
    "ffprobe -v quiet -print_format json -show_format -show_streams %{file_path}"

  VideoInfo = Data.define(
    :width,
    :height,
    :duration,
    :fps
  ) do
    def ratio = width.to_f / height

    def self.from_file(file_path)
      json = nil
      Executor.instance.call(
        FFPROBE_COMMAND, file_path:
      ) do |_, stdout, _|
        json = stdout.read
      end

      json = JSON.parse(json)

      json_streams = json["streams"]&.find{ |stream|
        stream["codec_type"] == "video"
      }
      json_format = json["format"]

      if json_streams.nil? || json_format.nil?
        raise "Invalid video file: #{file_path}"
      end

      # From fractional to float:
      fps = Rational(json_streams["r_frame_rate"]).to_f
      width = json_streams["width"].to_i
      height = json_streams["height"].to_i
      duration = json_format["duration"].to_f

      VideoInfo.new(
        width:,
        height:,
        duration:,
        fps:
      )
    end
  end
end
