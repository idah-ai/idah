# frozen_string_literal: true

module IdahVideo
  def self.init(context)
    context.register_processor(
      "video",
      Processor::Video,
      options: Processor::Options
    )
  end
end
