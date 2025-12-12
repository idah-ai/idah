module Context
  module IdahApi
    RootContext = Data.define(:name, :dataset)
    DatasetContext = Data.define(:dataset, :entry)
    EntryContext = Data.define(:entry, :media_info, :media_file, :annotation)
    AnnotationContext = Data.define(:annotation)
    ContextualizedAPI = Data.define(:list, :show) #,:update,:delete)

    def self.context(args, api = Api[:idah])
      RootContext.new(
        [:export, Time.now.to_i],
        contextualized_dataset_api(args, api))
    end

    def self.dataset_context(api, dataset, args)
      return if !dataset

      dataset_id =  dataset[:id] #
      DatasetContext.new(dataset, contextualized_entry_api(args, api, dataset_id))
    end

    def self.entry_context(api, entry, args)
      return if !entry

      media_response = api.media.medias.resource_info(
        resource: entry[:attributes][:resource]
      ) # ? seems loose
      raise if media_response.errors

      media_info = media_response.data
      file_response = api.media.medias.files( # todo io
        resource: entry[:attributes][:resource]
      )
      entry_id = entry[:id]

      EntryContext.new(
        entry,
        media_info,
        file_response,
        contextualized_annotation_api(args, api, entry_id)
      )
    end

    def self.annotation_context(_api, annotation, _filters)
      return if !annotation
      # could be extended with comments or else
      AnnotationContext.new(annotation)
    end

    def self.contextualized_dataset_api(args, api)
      ContextualizedAPI.new(
        lambda do |filters = {}| # list
          Verse::Util::Iterator.chunk_iterator(1) do |dataset_page|
            list_datasets(
              filters: Hash(filters).merge(
                Hash(args).slice(:dataset)
              ),
              page: {number: dataset_page, size: 100}, api:)
          end.lazy.map do |dataset|
            dataset_context api, dataset, args
          end
        end,
        lambda do |id| # show
          dataset_context(api, list_datasets(
            filters: Hash(args).slice(:dataset).merge(:id),
            page: {number: 1, size: 1}, api:
          )&.first.data, args)
        end)
    end

    def self.contextualized_entry_api(args, api, dataset_id)
      ContextualizedAPI.new(
        lambda do |filters = {}| # list
          Verse::Util::Iterator.chunk_iterator(1) do |entry_page|
            list_entries(
              filters: Hash(filters).merge(
                Hash(args).slice(:entry)
              ).merge({dataset_id:}),
              page: {number: entry_page, size: 100}, api:)
          end.lazy.map(&:data).map do |entry|
            entry_context api, entry, args
          end
        end,
        lambda do |id| # show
          entry_context(api, list_entries(
              filters: Hash(args).slice(:entry).merge({dataset_id:, id:}),
              page: {number: 1, size: 1}, api:
            )&.first.data, args)
        end)
    end

    def self.contextualized_annotation_api(args, api, entry_id)
      ContextualizedAPI.new(
        lambda do |filters = {}| # list
          Verse::Util::Iterator.chunk_iterator(1) do |annotation_page|
            list_annotations(
              filters: Hash(filters).merge(
                Hash(args).slice(:annotation)
              ).merge({entry_id:}),
              page: {number: annotation_page, size: 100}, api:)
          end.lazy.map(&:data).map do |annotation|
            annotation_context api, annotation, args
          end
        end,
        lambda do |id| # show
          annotation_context(api, list_annotations(
            filters: Hash(args).slice(:annotation).merge({entry_id:, id:}),
            page: {number: 1, size: 1}, api:
          )&.first.data, args)
        end)
    end

    def self.list_datasets(filters:, page: {number: 1, size: 100}, api: Api[:idah])
      dataset_response = api.dataset.datasets.index(filters:, page:, query_count: false)
      raise dataset_response.errors if dataset_response.errors

      dataset_response.data if !dataset_response.data.empty?
    end

    def self.list_entries(filters:, page:{number: 1, size: 100}, api: Api[:idah])
      entries_response = api.dataset.entries.index(
        filters:, page:, query_count: false)
      raise entries_response.errors if entries_response.errors

      entries_response.data if !entries_response.data.empty?
    end

    def self.list_annotations(filters:, page: {number: 1, size: 100}, api: Api[:idah])
      annotations_response = api.dataset.annotations.index(
        filters:, page:, query_count: false)
      raise annotations_response.errors if annotations_response.errors

      annotations_response.data if !annotations_response.data.empty?
    end
  end
end