# frozen_string_literal: true

module IdahImage
  class Media
    def self.init(context)
      context.register_processor(
        "idah-image",
        class_name: "IdahImage::Processor::Image",
        options_class_name: "IdahImage::Processor::Options",
        mime_types: ["^image/.*$"]
      )
    end
  end
end
