# frozen_string_literal: true

module Video
  module GenerateStreaming
    module_function

    FileOutput = Data.define(
      :master_m3u8, :streams
    )

    Stream = Data.define(
      :m3u8, :fragments
    )

    def generate(file_path, arguments, &block)
      file_path = File.absolute_path(file_path)

      dir = Dir.mktmpdir("idah_vp")
      video_info = Video::VideoInfo.from_file(file_path)

      sizes = arguments.sizes

      command = String.new
      master_m3u8 = String.new

      master_m3u8 << "#EXTM3U\n"
      master_m3u8 << "#EXT-X-VERSION:3\n"
      master_m3u8 << "#EXT-X-PLAYLIST-TYPE:VOD\n"
      master_m3u8 << "## Created with Ingedata Annotation Hub\n"

      command << "ffmpeg -v quiet -progress pipe:1 -i %<file_path>s "

      accepted_dimensions = sizes.map do |size|
        [size, *SCALE_FORMATS.fetch(size, size.to_i)]
      end.select do |_, height_pixel|
        height_pixel <= video_info.height
      end

      accepted_dimensions.map do |size, height_pixel, bitrate, audiobitrate|
        ratio = video_info.ratio

        width_pixel = (height_pixel * ratio).round
        width_pixel += 1 if width_pixel.odd? # for libx264 compatibility

        next unless height_pixel <= video_info.height

        command <<
          "-vf \"scale=#{width_pixel}:#{height_pixel}\" " \
          "-c:v libx264 -b:v #{bitrate} "
        command << if video_info.has_audio
                     "-c:a aac -b:a #{audiobitrate} "
                   else
                     # No audio
                     "-an "
                   end

        master_m3u8 <<
          "#EXT-X-STREAM-INF:PROGRAM-ID=1," \
          "BANDWIDTH=#{bitrate.to_i * 1024}," \
          "RESOLUTION=#{width_pixel}x#{height_pixel}," \
          "FRAME-RATE=#{video_info.fps} " \
          "#{size}.m3u8\n"

        command <<
          "-hls_time #{arguments.streaming_time_per_segment} " \
          "-hls_playlist_type vod " \
          "-hls_segment_filename \"#{size}_%%04d.ts\" " \
          "#{size}.m3u8 "
      end

      EXECUTOR.call(
        command, chdir: dir, file_path:
      ) do |_, stdout|
        stdout.each_line do |line|
          key, = line.split("=")
          if key == "out_time_us"
            # Give the progress output
            block&.call(time / video_info.duration)
          end
        end
      end

      # Generate the master m3u8 file
      File.write("#{dir}/master.m3u8", master_m3u8)

      # List the files in the directory and reconnect them with the streams
      streams = accepted_dimensions.map do |size, _|
        Stream.new(
          m3u8: "#{dir}/#{size}.m3u8",
          fragments: Dir.glob("#{dir}/#{size}_*.ts")
        )
      end

      output = FileOutput.new(
        master_m3u8: "#{dir}/master.m3u8",
        streams:
      )

      # Set progress to 100%
      block&.call(1.0)

      output
    end
  end
end
