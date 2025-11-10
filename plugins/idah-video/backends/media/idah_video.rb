# frozen_string_literal: true

module IdahVideo
  def self.init(context)
    context.register_processor(
      "idah-video",
      class_name: "IdahVideo::Processor::Video",
      options_class_name: "IdahVideo::Processor::Options"
    )
  end
end
