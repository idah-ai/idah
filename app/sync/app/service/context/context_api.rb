module Context
  module ContextApi
    Context = Data.define(:datasets, :entries, :annotations)

    def self.api(args, api = :idah)
      args = Hash(args)
      dataset_id = args.dig(:datasets, :id)
      entry_id = args.dig(:entries, :id)
      annotation_id = args.dig(:annotations, :id)
      datasets, entries, annotations = nil, nil, nil
      if (dataset_id)
        datasets = ContextApi::Datasets.new({id: dataset_id}, args, api),
        entries = ContextApi::Entries.new({dataset_id:}, args, api)
        # TODO check
        annotations = ContextApi::Annotations.new({dataset_id:}, args, api)
      elsif (entry_id)
        entries = ContextApi::Entries.new({id: entry_id}, args, api)
        entry = entries.show
        datasets = entry.datasets
        annotations = entry.annotations
      elsif (annotation_id)
        annotations = ContextApi::Annotations.new({id: annotation_id}, args, api)
        annotation = annotations.show
        entries = annotation.entries
        entry = entries.show
        datasets = entry.datasets
      end

      Context.new(
        datasets || ContextApi::Datasets.new({}, args, api),
        entries || ContextApi::Entries.new({}, args, api),
        annotations || ContextApi::Annotations.new({}, args, api)
      )
    end
  end
end