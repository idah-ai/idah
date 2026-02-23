# frozen_string_literal: true

module IdahImage
  module Processor
    OptionsSchema = Verse::Schema.define do
      field :generate_thumbnail, TrueClass, default: true, desc: "Generate a thumbnail version of the image."
      field :thumbnail_size, Integer, default: 480, desc: "Max dimension for thumbnail. Default is 480."
      field :processed_format, String, default: "webp", desc: "Target format for web display. Default is webp."
      field :processed_quality, Integer, default: 85, desc: "Quality for processed image. Default is 85."
      field :processed_max_size, Integer, default: 2048, desc: "Max dimension for optimized image. Default is 2048."
    end
  end
end
