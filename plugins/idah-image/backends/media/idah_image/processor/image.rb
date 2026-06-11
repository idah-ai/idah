# frozen_string_literal: true

require "fileutils"
require "rmagick"

module IdahImage
  module Processor
    class Image
      attr_reader :context

      def initialize(context)
        @context = context
      end

      def run
        file_path = context.download_original
        image_info = ImageInfo.from_file(file_path)
        max_size = context.config.processed_max_size

        # rmagick has limited width and height to 16k pixels by default
        if image_info.width > max_size || image_info.height > max_size
          raise Verse::Error::ValidationFailed,
                "Image width or height exceeded the limit of #{max_size}"
        end

        img = Magick::Image.read(file_path).first
        tmpdir = Dir.mktmpdir("idah-image-processor")

        context.update_original_metadata(image_info.to_h.slice(:width, :height, :format))

        generate_processed(img, tmpdir:)
        generate_thumbnail(img, tmpdir:) if context.config.generate_thumbnail

        context.progress = 1.0
      ensure
        File.delete(file_path) if file_path && File.exist?(file_path)
        FileUtils.rm_rf(tmpdir) if tmpdir
        img&.destroy!
      end

      private

      def generate_processed(img, tmpdir:)
        format = context.config.processed_format
        tmp_path = File.join(tmpdir, "processed.#{format}")
        img.write(tmp_path) { |i| i.quality = context.config.processed_quality }

        File.open(tmp_path, "rb") do |file|
          context.upload_media(
            file,
            "processed.#{format}",
            "image/#{format == "jpg" ? "jpeg" : format}"
          )
        end
      end

      def generate_thumbnail(img, tmpdir:)
        format = context.config.thumbnail_format
        size = context.config.thumbnail_size
        thumb = img.resize_to_fit(size, size)

        tmp_path = File.join(tmpdir, "thumbnail.#{format}")
        thumb.write(tmp_path) { |i| i.quality = context.config.processed_quality }

        File.open(tmp_path, "rb") do |file|
          context.upload_media(
            file,
            "thumbnail.#{format}",
            "image/#{format == "jpg" ? "jpeg" : format}"
          )
        end
      ensure
        thumb&.destroy!
      end
    end
  end
end
