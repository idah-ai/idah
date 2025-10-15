# frozen_string_literal: true

require "open3"

module IdahVideo
  module Processor
    module Ffmpeg
      extend self

      StreamVariant = Data.define(
        :name, :width, :height, :bitrate, :audiobitrate
      )

      def gen_stream(
        dir:,
        file:,
        variants:,
        streaming_time_per_segment: 5,
        &
      )
        args = []
        args += ["-v", "quiet", "-progress", "pipe:1", "-i", file]

        variants.each do |variant|
          args += [
            "-vf", "scale=#{variant.width}:#{variant.height}",
            "-c:v", "libx264", "-b:v", variant.bitrate.to_s
          ]

          args += if variant.audiobitrate
                    # Audio
                    ["-c:a", "aac", "-b:a", variant.audiobitrate.to_s]
                  else
                    # No audio
                    ["-an"]
                  end

          args += [
            "-hls_time", streaming_time_per_segment.to_s,
            "-hls_playlist_type", "vod",
            "-hls_segment_filename", "#{variant.name}_%04d.ts",
            "#{variant.name}.m3u8"
          ]
        end

        call(*args, chdir: dir) do |stdout|
          stdout.each_line do |line|
            key, value = line.chomp.split("=")
            next unless key == "out_time_us"

            time = value.to_i / 1_000_000.0 # Convert microseconds to seconds

            yield time if block_given?
          end
        end
      end

      def gen_thumbnail(
        file, images, chdir,
        scale: "240:-1",
        output: "thumb_%02d.jpg"
      )
        call(
          "-i",
          file,
          "-vf",
          "fps=#{images},scale=#{scale}",
          "-fps_mode",
          "vfr",
          "-frames:v",
          images.to_s,
          "-q:v",
          "2",
          output,
          "-y",
          chdir:
        )
      end

      def call(*args, **kv, &)
        Open3.popen3("ffmpeg", *args, **kv) do |_, stdout, stderr, wait_thr|
          yield stdout, stderr if block_given?

          result = wait_thr.value

          if result != 0
            err = stderr.read
            error = "Failed to execute `ffmpeg #{args.join(" ")}`: #{result}\n#{err}"
            Verse.logger&.error{ error }
            raise "Failed to execute ffmpeg: #{result}\n#{err}"
          end
        end
      end
    end
  end
end
