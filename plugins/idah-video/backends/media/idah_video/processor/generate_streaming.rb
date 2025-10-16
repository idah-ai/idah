# frozen_string_literal: true

module IdahVideo
  module Processor
    module GenerateStreaming
      module_function

      FileOutput = Data.define(
        :tmpdir,
        :master_m3u8,
        :streams
      )

      Stream = Data.define(
        :m3u8, :fragments
      )

      def call(file_path, video_info, options, tmpdir: nil, &block)
        file_path = File.absolute_path(file_path)

        tmpdir ||= Dir.mktmpdir("idah-video-processor")

        sizes = options.sizes

        master_m3u8 = String.new

        master_m3u8 << "#EXTM3U\n"
        master_m3u8 << "#EXT-X-VERSION:3\n"
        master_m3u8 << "#EXT-X-PLAYLIST-TYPE:VOD\n"
        master_m3u8 << "## Created with Ingedata Annotation Hub\n"

        accepted_dimensions = sizes.map do |size|
          [size, *SCALE_FORMATS.fetch(size, size.to_i)]
        end.select do |_, height_pixel|
          height_pixel <= video_info.height
        end

        variants = accepted_dimensions.map do |size, height_pixel, bitrate, audiobitrate|
          ratio = video_info.ratio

          width_pixel = (height_pixel * ratio).round
          width_pixel += 1 if width_pixel.odd? # for libx264 compatibility

          has_audio = video_info.has_audio

          master_m3u8 <<
            "#EXT-X-STREAM-INF:PROGRAM-ID=1," \
            "BANDWIDTH=#{bitrate.to_i * 1024}," \
            "RESOLUTION=#{width_pixel}x#{height_pixel}," \
            "CODECS=\"avc1.42E01E,mp4a.40.2\"," \
            "FRAME-RATE=#{video_info.fps}" \
            "\n#{size}.m3u8\n"

          Ffmpeg::StreamVariant.new(
            name: size,
            width: width_pixel,
            height: height_pixel,
            bitrate:,
            audiobitrate: has_audio ? audiobitrate : nil
          )
        end

        Ffmpeg.gen_stream(
          dir: tmpdir,
          file: file_path,
          variants:,
          streaming_time_per_segment: options.streaming_time_per_segment
        ) do |progress|
          block&.call(progress / video_info.duration)
        end

        # Generate the master m3u8 file
        File.write("#{tmpdir}/master.m3u8", master_m3u8)

        # List the files in the directory and reconnect them with the streams
        streams = accepted_dimensions.map do |size, _|
          Stream.new(
            m3u8: "#{tmpdir}/#{size}.m3u8",
            fragments: Dir.glob("#{tmpdir}/#{size}_*.ts")
          )
        end

        output = FileOutput.new(
          tmpdir:,
          master_m3u8: "#{tmpdir}/master.m3u8",
          streams:
        )

        # Set progress to 100%
        block&.call(1.0, output)

        output
      ensure
        # Clean up the temporary directory
        FileUtils.rm_rf(tmpdir) if tmpdir && File.exist?(tmpdir)
      end
    end
  end
end
