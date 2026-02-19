# frozen_string_literal: true

module IdahImage
  module Processor
    ImageInfo = Data.define(
      :width,
      :height,
      :format
    ) do
      def self.from_file(file_path)
        # placeholder for basic image info extraction
        # in the future, this could use `identify` or a library like `vips` or `rmagick`
        new(
          width: 0,
          height: 0,
          format: File.extname(file_path).delete(".")
        )
      end
    end
  end
end
