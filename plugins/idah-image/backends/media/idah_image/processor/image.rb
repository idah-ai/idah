# frozen_string_literal: true

require "securerandom"

module IdahImage
  module Processor
    class Image
      attr_reader :context

      def initialize(context)
        @context = context
      end

      def run
        file_path = context.download_original

        # optimized web asset
        generate_processed(file_path)

        # thumbnail
        generate_thumbnail(file_path) if context.config.generate_thumbnail

        context.progress = 1.0
      ensure
        File.delete(file_path) if file_path && File.exist?(file_path)
      end

      private

      def generate_processed(file_path)
        image_info = ImageInfo.from_file(file_path)
        format = context.config.processed_format
        max_size = context.config.processed_max_size

        width = image_info.width
        height = image_info.height
        scale = (width > max_size || height > max_size) ? "#{max_size}:#{max_size}" : nil

        tmp_path = File.join(Dir.tmpdir, "processed.#{format}")

        last_progress_time = 0

        Ffmpeg.convert(
          input: file_path,
          output: tmp_path,
          scale: scale,
          quality: context.config.processed_quality
        ) do |progress|
          now = Time.now.to_f
          if (now - last_progress_time >= 0.2) || progress >= 1.0
            last_progress_time = now
            # Verse.logger.info { "[IdahImage] Processing image: #{(progress * 100).round(2)}%" }
            context.progress = progress * 0.99
          end
        end

        File.open(tmp_path, "rb") do |file|
          context.upload_media(
            file,
            "processed.#{format}",
            "image/#{format == "jpg" ? "jpeg" : format}"
          )
        end
      ensure
        File.delete(tmp_path) if tmp_path && File.exist?(tmp_path)
      end

      def generate_thumbnail(file_path)
        size = context.config.thumbnail_size
        tmp_path = File.join(Dir.tmpdir, "thumbnail.jpg")

        Ffmpeg.convert(
          input: file_path,
          output: tmp_path,
          scale: "#{size}:#{size}"
        )

        File.open(tmp_path, "rb") do |file|
          context.upload_media(file, "thumbnail.jpg", "image/jpeg")
        end
      ensure
        File.delete(tmp_path) if tmp_path && File.exist?(tmp_path)
      end
    end
  end
end
