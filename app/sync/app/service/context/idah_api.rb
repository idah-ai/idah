module Context
  module IdahApi
    RootContext = Data.define(:name, :dataset)
    DatasetContext = Data.define(:dataset, :entry)
    EntryContext = Data.define(:entry, :media_info, :media_file, :annotation)
    AnnotationContext = Data.define(:annotation)

    def self.context(args, api = Api[:idah])
      RootContext.new(
        [:export, Time.now.to_i].join("."),
        ContextApi.new(
          lambda { |api, dataset, args| dataset_context(api, dataset, args) },
          api.dataset.datasets, {}, args, api))
    end

    def self.dataset_context(dataset, args, api)
      DatasetContext.new(
        dataset,
        ContextApi.new(
          proc { |api, entry, args| entry_context(api, entry, args) },
          api.dataset.entries, {dataset_id: dataset[:id]}, args, api))
    end

    def self.entry_context(entry, args, api)
      media_response = api.media.medias.resource_info(
        resource: entry[:attributes][:resource]
      ) # ? seems loose
      raise media_response.errors if media_response.errors

      media_info = media_response.data
      # TODO: stream io
      io = api.media.medias.files(resource: entry[:attributes][:resource])
      EntryContext.new(
        entry, media_info, io,
        ContextApi.new(
          proc { |api, annotation, args| annotation_context(api, annotation, args) },
          api.dataset.annotations, {entry_id: entry[:id]}, args, api))
    end

    def self.annotation_context(annotation, _args, _api)
      # could be extended with comments or else
      AnnotationContext.new(annotation)
    end
  end
end