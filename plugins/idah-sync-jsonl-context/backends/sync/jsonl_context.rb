# frozen_string_literal: true

module JsonlContext
  def self.init(context)
    context.register_processor(
      "idah-sync-jsonl-context",
      class_name: "JsonlContext::Root"
    )
  end
end
