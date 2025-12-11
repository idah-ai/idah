# frozen_string_literal: true

module JsonlProcess
  def self.init(context)
    context.register_processor(
      "idah-sync-jsonl-process",
      class_name: "JsonlProcess::Sync"
    )
  end
end
