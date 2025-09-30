# frozen_string_literal: true

module Datset
  class Service < Verse::Service::Base
    use dataset_repo: Dataset::Repository,
        entry_repo: Entry::Repository,
        annotation_repo: Annotation::Repository

    # TODO: figure out how to handle different hosting option

    # delete the .datset file
    # the processed file should not need to be kept for
    # 1. after importing, regardless of being successful or failed
    # 2. after exported if hosted by us (no need to delete if self/locally hosted, can be kept in local directory)
    def delete
      pass
    end

    # import a datset file
    # TODO: recheck if resource is needed
    def import(file:, project_id:)
      # 1. receive .datset file and project id
      datset_data = {}
      # 2. read file content and validate with DatsetSchema
      Verse::Plugin[:shrine].with_storage do |storage|
        uploaded_file = storage.open(storage.upload(file.tempfile).id)
        uploaded_content = JSON.parse(uploaded_file.read)
        datset_data = uploaded_content.transform_keys(&:to_sym)
      end

      dataset_data = datset_data[:dataset].transform_keys(&:to_sym)
      # TODO: check/process metadata ?

      # 3. in transaction, create dataset, entries, annotations
      # TODO: handle insertion of media/job ? download through links ? upload and match/find with resource name/id ?
      dataset_repo.transaction do
        # create dataset
        dataset_id = dataset_repo.create(
          {
            project_id:,
            name: dataset_data[:name],
            modality: dataset_data[:modality],
            workflow_configuration: {},
            labeling_configuration: {}, # TODO: recheck if labeling config import is possible/feasible
          }
        )

        # create entries and their annotations
        dataset_data[:entries].each do |entry_data|
          entry_data = entry_data.transform_keys(&:to_sym)
          # create the entry
          entry_id = entry_repo.create(
            dataset_id: dataset_id,
            resource: entry_data[:media_url]
          )

          # create annotations for this entry
          entry_data[:annotations].each do |annotation_data|
            annotation_data = annotation_data.transform_keys(&:to_sym)
            annotation_data[:dimensions][:type] = annotation_data[:type]
            annotation_repo.create(
              entry_id: entry_id,
              # category: annotation_data[:category]
              dimensions: annotation_data[:dimensions] || {},
              annotation: annotation_data[:annotation] || {},
            )
          end
        end

        # 4. return created dataset
        dataset_repo.find!(dataset_id)
      end
    end

    # export into a datset file
    # TODO: might need to wait for pending media jobs ?
    def export(dataset_id)
      datset = create_datset(dataset_id)

      # export as .datset
      # TODO: save file in a proper file store, currently just write here, look at medias/video service
      File.write("#{dataset_id}.datset", JSON.pretty_generate(datset)) # temporary implementation, save as local file

      # 1. cloud-hosted: return download link for .datset file
      # 2. self-hosted: save file to designated directory
    end

    def create_datset(dataset_id)
      # prep data to datset structure
      dataset = dataset_repo.find!(dataset_id) # testing id
      # TODO: handle not found error

      entries = entry_repo.index({ dataset_id: dataset.id }) # sort by id ? created_at ? updated_at ?
      annotations = annotation_repo.index({ entry_id__in: entries.map(&:id) }) # sort by id ? created_at ? updated_at ?

      # turn records into datset schema
      formatted_datset = {
        dataset: { # this layer is not needed if we are stricting only 1 dataset ?
          id: dataset.id,
          name: dataset.name,
          modality: dataset.modality, # topology = modality ?
          metadata: "this should be some kind of a metadata",
          entries: []
        },
        # "media": {}, # still not sure how to handle actual media,  from media service ? optional ?
      }

      # loop through each entry
      entries.each do |entry|
        formatted_datset[:dataset][:entries] << { # add entries into dataset
          id: entry[:id],
          media_url: entry.resource,
          annotations: annotations.filter_map do |annotation| # build the entry object with annotations
            next unless annotation[:entry_id] == entry[:id]

            {
              id: annotation[:id],
              type: annotation.dimensions[:type], # annotation.type ?
              # category: "category", # Q: annotation.category ?
              dimensions: annotation.dimensions,
              annotation: annotation.annotation, # Q: is this needed ?
              # metadata:,
            }
          end,
          # metadata:,
        }
      end

      # TODO: handle possible error from validation ?
      DatsetSchema.validate(formatted_datset).value
    end

    AnnotationSchema = Verse::Schema.define do
      field(:id, String) # PK, CHECK(length(id) <= 64)
      field(:type, String) # Type of annotation, e.g., bounding_box, segmentation
      field(:dimensions, Hash) # TODO: recheck data type
      field?(:annotation, Hash) # TODO: recheck data type
      field?(:category, String) # labeling ? tagging ?
      field?(:metadata, String)
    end

    EntrySchema = Verse::Schema.define do
      field(:id, String) # PK, CHECK(length(id) <= 64)
      field(:media_url, String) # resource ?
      field?(:metadata, String)
      field?(:annotations, Array, of: AnnotationSchema)
    end

    # TODO: still not sure how to handle actual files in imported/exported datset
    MediaSchema = Verse::Schema.define do
      field(:id, String) # PK
      field(:key, String) # PK
      field?(:blob_data, String) # BLOB
      field?(:media_type, String)
      field?(:metadata, String)
    end

    DatasetSchema = Verse::Schema.define do
      field(:id, String) # PK, CHECK(length(id) <= 64)
      field(:name, String)
      field(:modality, String) # Data topology, ex: imageset, video, etc.
      field?(:metadata, String) # Such as allowed annotation types, domain specific data
      field?(:entries, Array, of: EntrySchema)
    end

    # Datset file structure (in JSON ? or SQLite ?)
    DatsetSchema = Verse::Schema.define do
      field(:dataset, DatasetSchema) # just one or multiple ?
      field?(:media, MediaSchema) # just one or multiple ?
      field(:metadata, Hash).default({ type: "datset", version: "1.0" })
    end
  end
end
