# frozen_string_literal: true

module UniversalPortableDatasetProcess
  def self.init(context)
    context.register_processor(
      "idah-sync-upd-process",
      class_name: "UniversalPortableDatasetProcess::Sync"
    )
  end
end
