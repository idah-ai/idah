# frozen_string_literal: true


module IdahImage
  module Processor
    ImageInfo = Data.define(
      :filename,
      :width,
      :height,
      :format
    ) do
      def self.from_file(file_path)
        metadata = Ffprobe.identity(file_path)
        stream = metadata[:streams].find { |s| s[:codec_type] == "video" } # images are often marked as video streams in ffprobe

        raise "No video stream found in image file" unless stream
        
        width = stream[:width].to_i
        height = stream[:height].to_i

        if width <= 0 || height <= 0
          error_msg = "Could not determine valid image dimensions (found #{width}x#{height}). Metadata: #{metadata.inspect}"
          Verse.logger&.error { error_msg }
          raise error_msg
        end

        new(
          filename: File.basename(file_path),
          width: width,
          height: height,
          format: metadata[:format][:format_name].split(",").first
        )
      end
    end
  end
end
