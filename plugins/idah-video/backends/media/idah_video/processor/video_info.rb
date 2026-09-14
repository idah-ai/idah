# frozen_string_literal: true

module IdahVideo
  module Processor
    VideoInfo = Data.define(
      :width,
      :height,
      :duration,
      :r_frame_rate,
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
        r_frame_rate = json_streams[:r_frame_rate]
        fps = Rational(r_frame_rate).to_f
        width = json_streams[:width].to_i
        height = json_streams[:height].to_i

        # Prefer the video stream duration over the container (format) duration.
        # For MPEG-TS files the container duration can be longer than the video
        # (e.g. a KLV metadata stream that outlasts the video track), which makes
        # `duration * fps` overestimate the number of frames.
        duration = (json_streams[:duration] || json_format[:duration]).to_f

        VideoInfo.new(
          width:,
          height:,
          duration:,
          r_frame_rate:,
          fps:,
          has_audio:
        )
      end
    end
  end
end
