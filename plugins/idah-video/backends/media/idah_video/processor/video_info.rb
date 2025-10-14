# frozen_string_literal: true

module IdahVideo
  module Processor
    VideoInfo = Data.define(
      :width,
      :height,
      :duration,
      :fps,
      :has_audio
    ) do
      def ratio = width.to_f / height

      def self.from_file(file_path)
        json = Ffprobe.identity(file_path)

        json_streams = json[:streams]&.find{ |stream|
          stream[:codec_type] == "video"
        }

        has_audio = json[:streams]&.any?{ |stream|
          stream[:codec_type] == "audio"
        }

        json_format = json[:format]

        # From fractional to float:
        fps = Rational(json_streams[:r_frame_rate]).to_f
        width = json_streams[:width].to_i
        height = json_streams[:height].to_i
        duration = json_format[:duration].to_f

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
end
