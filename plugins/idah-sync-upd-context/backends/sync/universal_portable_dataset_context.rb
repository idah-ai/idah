# frozen_string_literal: true

module UniversalPortableDatasetContext
  def self.init(context)
    context.register_processor(
      "idah-sync-upd-context",
      class_name: "UniversalPortableDatasetContext::Root"
    )
  end
end
