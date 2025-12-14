module Context
  RootContext = Data.define(:name, :datasets, :entries, :annotations)

  def self.root(args, api = :idah)
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
    RootContext.new(
      [:export, Time.now.to_i].join("."),
      datasets || ContextApi::Datasets.new({}, args, api),
      entries || ContextApi::Entries.new({}, args, api),
      annotations || ContextApi::Annotations.new({}, args, api)
    )
  end
end