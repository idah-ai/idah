# frozen_string_literal: true

module IdahImage
  module Processor
    OptionsSchema = Verse::Schema.define do
      field :generate_thumbnail, TrueClass, default: true, desc: "Generate a thumbnail version of the image."
    end
  end
end
