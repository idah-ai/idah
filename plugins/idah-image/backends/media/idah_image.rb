# frozen_string_literal: true

module IdahImage
  def self.init(context)
    context.register_processor(
      "idah-image",
      class_name: "IdahImage::Processor::Image",
      options_class_name: "IdahImage::Processor::Options"
    )
  end
end
