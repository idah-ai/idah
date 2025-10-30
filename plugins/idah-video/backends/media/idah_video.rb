# frozen_string_literal: true

module IdahVideo
  def self.init(context)
    context.register_processor(
      "video",
      class_name: "Processor::Video",
      options_class_name: "Processor::Options"
    )
  end
end
