module Video
  module GenerateStreaming
    module_function

    def generate(file_path, arguments, &block)
      video_info = Video::VideoInfo.from_file(file_path)

      sizes = arguments.sizes

      command = String.new
      master_m3u8_builder = String.new

      master_m3u8_builder << "#EXTM3U\n"
      master_m3u8_builder << "#EXT-X-VERSION:3\n"
      master_m3u8_builder << "#EXT-X-PLAYLIST-TYPE:VOD\n"
      master_m3u8_builder << "## Created with Ingedata Annotation Hub\n"

      command << "ffmpeg -v quiet -progress pipe:1 -i %{file_path} "

      dimensions = sizes.each do |size|
        height_pixel, bitrate, audiobitrate = SCALE_FORMATS.fetch(size, size.to_i)
        ratio = video_info.ratio
        width_pixel = (height_pixel * ratio).round
        width_pixel += 1 if width_pixel.odd? # for libx264 compatibility

        if height_pixel <= video_info.height
          command <<
            "-vf \"scale=#{width_pixel}:#{height_pixel}\" " \
            "-c:v libx264 -b:v #{bitrate} "
          if video_info.has_audio
            command <<
              "-c:a aac -b:a #{audiobitrate} "
          else
            # No audio
            command << "-an "
          end

          master_m3u8_builder << "#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=#{bitrate.to_i * 1024},RESOLUTION=#{width_pixel}x#{height_pixel},FRAME-RATE=#{video_info.fps} playlist_#{size}.m3u8\n"

          command <<
            "-hls_time #{arguments.streaming_time_per_segment} " \
            "-hls_playlist_type vod " \
            "-hls_segment_filename \"#{size}_%%04d.ts\" " \
            "playlist_#{size}.m3u8 "
        end
      end

      puts master_m3u8_builder

      puts command

      Executor.instance.call(
        command, file_path:
      ) do |_, stdout|
        stdout.each_line do |line|
          key, value = line.split("=")
          if key == "out_time_us"
            block&.call(time / video_info.duration)
          end
        end
      end

      block&.call(1.0)
    end
  end
end
