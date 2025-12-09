# frozen_string_literal: true

module UniversalPortableDataset
  def self.init(context)
    context.register_processor(
      "idah-sync-upd",
      class_name: "UniversalPortableDataset::Processor::Export"
    )
  end
end
