# frozen_string_literal: true

module IdahImage
  module Processor
    OptionsSchema = Verse::Schema.define do
      field :processed_format, String, default: "webp", desc: "Target format for web display. Default is webp."
      field :processed_quality, Integer, default: 80, desc: "Quality for processed image. Default is 80."
      field :processed_max_size, Integer, default: 16_384, desc: "Max dimension for optimized image. Default is 16KP."
      field :generate_thumbnail, TrueClass, default: true, desc: "Generate a thumbnail version of the image."
      field :thumbnail_format, String, default: "webp", desc: "Target format for thumbnail. Default is webp."
      field :thumbnail_size, Integer, default: 240, desc: "Max dimension for thumbnail. Default is 240."
    end
  end
end
