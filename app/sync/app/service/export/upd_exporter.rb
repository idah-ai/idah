module Export
  class UpdExporter

    def name = "Universal Portable Dataset"

    def description = "Export to UPD file. This format export metadata"

    def options = Verse::Schema.empty

    def export(context)
      context.datasets.each do |dataset|
        append_dataset(dataset)

        dataset.entries.each do |entry|
          append_entry(entry)
        end
      end
    end

    private

    def append_dataset(dataset)
      # append dataset
    end

    def append_entry(entry)
      # append entry
    end
  end
end