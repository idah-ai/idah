module Context
  module ContextApi
    Context = Data.define(:datasets, :entries, :annotations)

    def self.api(args = {}, api = :idah)
      args = Hash(args)
      dataset_id = args.dig(:datasets, :id)
      entry_id = args.dig(:entries, :id)
      annotation_id = args.dig(:annotations, :id)
      datasets, entries, annotations = nil, nil, nil
      if (dataset_id)
        datasets = ContextApi::Datasets.new(api, args)
        entries = ContextApi::Entries.new(api, merge_args(args, :entries, {dataset_id:}))
        # TODO check
        annotations = ContextApi::Annotations.new(api, merge_args(args, :annotations, {dataset_id:}))
      elsif (entry_id)
        entries = ContextApi::Entries.new(api, args)
        entry = entries.show
        datasets = entry.datasets
        annotations = entry.annotations
      elsif (annotation_id)
        annotations = ContextApi::Annotations.new(api, args)
        annotation = annotations.show
        entries = annotation.entries
        # datasets = ContextApi::Annotations.new(api, merge_args(args, :annotations, annotation.record[:attributes][:dataset_id]))
        entry = entries.show
        datasets = entry.datasets
      end


      Context.new(
        datasets || ContextApi::Datasets.new(api, args),
        entries || ContextApi::Entries.new(api, args),
        annotations || ContextApi::Annotations.new(api, args)
      )
    end

    def merge_args(args, type, filters)
      args.merge(Hash(args[type]).merge(filters))
    end
  end
end
