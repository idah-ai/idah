# frozen_string_literal: true

require "open3"

module IdahImage
  module Processor
    module Ffmpeg
      extend self

      def convert(input:, output:, scale: nil, quality: 75, &block)
        args = ["-probesize", "100M", "-analyzeduration", "100M", "-max_pixels", "2147483647", "-progress", "pipe:1", "-i", input]

        if scale
          # Robust scaling: ensures aspect ratio is preserved and result fits within 'scale' dimensions.
          # We also ensure dimensions are even (using trunc(oh/2)*2) to satisfy many encoders.
          args += ["-vf", "scale=#{scale}:force_original_aspect_ratio=decrease,pad='ceil(iw/2)*2':'ceil(ih/2)*2':(ow-iw)/2:(oh-ih)/2"]
        end

        # Force pixel format for compatibility
        if [".jpg", ".jpeg"].include?(File.extname(output))
          # JPEG likes yuvj420p (full range) to avoid "deprecated pixel format" warnings
          args += ["-pix_fmt", "yuvj420p"]
        else
          # Force pixel format to yuv420p for maximum compatibility (e.g. CMYK sources)
          args += ["-pix_fmt", "yuv420p"]
        end

        # Ensure only a single frame is processed and output
        # This fixes the "does not contain an image sequence pattern" error
        args += ["-frames:v", "1"]

        # Assuming webp as the target for optimized web asset as suggested by user
        if File.extname(output) == ".webp"
          args += ["-c:v", "libwebp", "-quality", quality.to_s]
        elsif [".jpg", ".jpeg"].include?(File.extname(output))
          args += ["-q:v", "2"] # High quality for jpeg
        end

        args += [output, "-y"]

        call(*args) do |stdout|
          stdout.each_line do |line|
            if line =~ /progress=end/ || line =~ /frame=1/
              block&.call(1.0)
            end
          end
        end
      end

      def call(*args, **kv, &)
        Open3.popen3("ffmpeg", *args, **kv) do |_, stdout, stderr, wait_thr|
          # Ensure stderr is always read in a thread to prevent deadlock
          err_t = Thread.new { stderr.read }

          if block_given?
            yield stdout, stderr
          else
            out_t = Thread.new { stdout.read }
            out_t.join
          end

          err_t.join
          result = wait_thr.value

          unless result.success?
            error = "Failed to execute `ffmpeg #{args.join(" ")}`: #{result}\n#{err_t.value}"
            Verse.logger&.error { error }
            raise error
          end
        end
      end
    end
  end
end
