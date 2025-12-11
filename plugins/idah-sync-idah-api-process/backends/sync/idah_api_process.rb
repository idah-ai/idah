# frozen_string_literal: true

module IdahApiProcess
  def self.init(context)
    context.register_processor(
      "idah-sync-idah-api-process",
      class_name: "IdahApiProcess::Sync"
    )
  end
end
