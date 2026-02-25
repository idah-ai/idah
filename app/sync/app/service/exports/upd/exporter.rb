# frozen_string_literal: true

module Exports
  module Upd
    class Exporter
      def name = "Universal Portable Dataset"
      def description = "Export to UPD file."
      def options = Verse::Schema.empty

      def export(context)
        # Example for now - just export all datasets + entries + annotations to a single JSON file.
        file = context.io.file(format: "json")

        records = []
        context.datasets.each do |dataset|
          record = { dataset: dataset.dataset.data[:attributes], entries: [] }

          dataset.entries.each do |entry|
            entry_data = entry.entry.data[:attributes]

            entry_data[:annotations] ||= []
            entry.annotations.each do |annotation|
              entry_data[:annotations] << annotation.annotation.data[:attributes]
            end

            record[:entries] << entry_data
          end

          records << record
        end

        file.write(records.to_json)
      end
    end
  end
end
