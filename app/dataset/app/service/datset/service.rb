# frozen_string_literal: true

module Datset
  class Service < Verse::Service::Base
    use dataset_repo: Dataset::Repository,
        entry_repo: Entry::Repository,
        annotation_repo: Annotation::Repository

    # import a datset file
    def import(file_path:, project_id:)
      # 1. receive .datset file and project id
      # 2. read file content and validate with DatsetSchema
      # TODO: properly read from file store
      datset_data = JSON.parse(File.read(file_path)).transform_keys(&:to_sym)
      dataset_data = datset_data[:dataset].transform_keys(&:to_sym)
      # TODO: check/process metadata ?

      # 3. in transaction, create dataset, entries, annotations
      dataset_repo.transaction do
        # create dataset
        dataset_id = dataset_repo.create({
          project_id:,
          name: dataset_data[:name],
          modality: dataset_data[:topology],
          workflow_configuration: {},
          labeling_configuration: {},
        })

        # create entries and their annotations
        dataset_data[:entries].each do |entry_data|
          entry_data = entry_data.transform_keys(&:to_sym)
          # create the entry
          entry_id = entry_repo.create(
            id: entry_data[:id],
            dataset_id: dataset_id,
            resource: entry_data[:media_url]
            # add other entry fields as needed
          )
          
          # create annotations for this entry
          entry_data[:annotations].each do |annotation_data|
            annotation_data = annotation_data.transform_keys(&:to_sym)
            annotation_repo.create(
              id: annotation_data[:id],
              entry_id: entry_id,
              # type: annotation_data[:type],
              # category: annotation_data[:category]
              dimensions: annotation_data[:dimensions] || {},
              annotation: annotation_data[:annotation] || {}, # Q: is this needed to be imported ?
              # add other annotation fields as needed
            )
          end
        end

        # 4. return created dataset
        dataset_repo.find!(dataset_id)
      end
    end

    # export into a datset file
    def export(dataset_id)
      datset = create_datset(dataset_id)

      # export as .datset
      # TODO: save file in a proper file store, currently just write here
      File.write("#{dataset_id}.datset", JSON.pretty_generate(datset))
    end

    def create_datset(dataset_id)
      # prep data to datset structure
      dataset = dataset_repo.find!("dataset_id") # testing id
      # TODO: handle not found error

      entries = entry_repo.index({dataset_id: dataset.id}) # sort by id ? created_at ? updated_at ?
      annotations = annotation_repo.index({entry_id__in: entries.map(&:id)}) # sort by id ? created_at ? updated_at ?
      
      # turn records into datset schema
      formatted_datset = {
        dataset: { # this layer is not needed if we are stricting only 1 dataset ?
          id: dataset.id,
          name: dataset.name,
          topology: dataset.modality, # topology = modality ?
          metadata: "this should be some kind of a metadata",
          entries: []
        },
        # "media": {}, # optional ? or from media service ?
        metadata: { "type": "datset", "version": "1.0" } # this is default datset metadata
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
              type: "bounding_box", # annotation.type ?
              category: "category", # Q: annotation.category ?
              dimensions: annotation.dimensions,
              # annotation: "", # Q: is this needed ?
              # metadata:,
            }
          end
        }
      end

      # TODO: handle possible error from validation ?
      DatsetSchema.validate(formatted_datset).value
    end

    AnnotationSchema = Verse::Schema.define do
      field(:id, String) # PK, CHECK(length(id) <= 64)
      field(:type, String) # Type of annotation, e.g., bounding_box, segmentation
      field(:dimensions, String)
      # field?(:annotation, String) # is this needed ?
      field?(:category, String)
      field?(:metadata, String)
    end

    EntrySchema = Verse::Schema.define do
      field(:id, String) # PK, CHECK(length(id) <= 64)
      field(:media_url, String) # resource ?
      field?(:metadata, String)
      field?(:annotations, Array, of: AnnotationSchema)
    end

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
      field(:topology, String) # Data topology, ex: imageset, video, etc.
      field?(:metadata, String) # Such as allowed annotation types, domain specific data
      field?(:entries, Array, of: EntrySchema)
    end

    # Datset file structure (in JSON ?)
    DatsetSchema = Verse::Schema.define do
      field(:dataset, DatasetSchema) # just one or multiple ?
      field?(:media, MediaSchema) # just one or multiple ?
      field(:metadata, Hash).default({ "type": "datset", "version": "1.0" })
    end
  end
end
