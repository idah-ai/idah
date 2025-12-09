# frozen_string_literal: true

module Jsonl
  def self.init(context)
    context.register_processor(
      "idah-sync-jsonl",
      class_name: "Jsonl::Processor::Export"
    )
  end
end
