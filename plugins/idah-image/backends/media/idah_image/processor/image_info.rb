# frozen_string_literal: true

require "rmagick"

module IdahImage
  module Processor
    ImageInfo = Data.define(
      :filename,
      :width,
      :height,
      :format
    ) do
      def self.from_file(file_path)
        img = Magick::Image.ping(file_path).first
        new(
          filename: img.filename,
          width: img.columns,
          height: img.rows,
          format: img.format.downcase
        )
      end
    end
  end
end
