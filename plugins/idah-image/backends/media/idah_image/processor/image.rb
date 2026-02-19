# frozen_string_literal: true

module IdahImage
  module Processor
    class Image
      attr_reader :context

      def initialize(context)
        @context = context
      end

      def run
        file_path = context.download_original

        # minimal extraction for now
        image_info = ImageInfo.from_file(file_path)

        # for simple start, just upload the original as the "processed" result
        # use image/jpeg as a generic placeholder or could detect it from image_info
        File.open(file_path, "rb") do |file|
          context.upload_media(
            file,
            "original.#{image_info.format}",
            "image/#{image_info.format == "jpg" ? "jpeg" : image_info.format}"
          )
        end

        context.progress = 1.0
      ensure
        File.delete(file_path) if file_path && File.exist?(file_path)
      end
    end
  end
end
