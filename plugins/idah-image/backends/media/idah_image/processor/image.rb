# frozen_string_literal: true

require "rmagick"
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

        img = Magick::Image.read(file_path).first

        # capping size in case of very big image, might not needed or need a different processing
        img.resize_to_fit!(max_size, max_size) if image_info.width > max_size || image_info.height > max_size

        tmp_path = File.join(Dir.tmpdir, "processed.#{format}")
        img.write(tmp_path) { |i| i.quality = context.config.processed_quality }

        File.open(tmp_path, "rb") do |file|
          context.upload_media(
            file,
            "processed.#{format}",
            "image/#{format == "jpg" ? "jpeg" : format}"
          )
        end
      ensure
        File.delete(tmp_path) if tmp_path && File.exist?(tmp_path)
        img&.destroy!
      end

      def generate_thumbnail(file_path)
        size = context.config.thumbnail_size

        img = Magick::Image.read(file_path).first
        thumb = img.resize_to_fit(size, size)

        tmp_path = File.join(Dir.tmpdir, "thumbnail.jpg")
        thumb.write(tmp_path) { |i| i.quality = context.config.processed_quality }

        File.open(tmp_path, "rb") do |file|
          context.upload_media(file, "thumbnail.jpg", "image/jpeg")
        end
      ensure
        File.delete(tmp_path) if tmp_path && File.exist?(tmp_path)
        img&.destroy!
        thumb&.destroy!
      end
    end
  end
end
