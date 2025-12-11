# frozen_string_literal: true

module IdahApiContext
  def self.init(context)
    context.register_processor(
      "idah-sync-idah-api-context",
      process_class_name: "IdahApiContext::Root"
    )
  end
end
