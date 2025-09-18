# frozen_string_literal: true

module Dataset
  # Datset file structure (in JSON ?)
  DatsetSchema = Verse.define do
    field(:dataset, DatasetSchema) # just one or multiple ?
    field?(:media, MediaSchema) # just one or multiple ?
    field(:metadata, MetadataSchema).default({ "type": "datset", "version": "1.0" })
  end

  DatasetSchema = Verse.define do
    field(:id, String) # PK, CHECK(length(id) <= 64)
    field(:name, String)
    field(:topology, String) # Data topology, ex: imageset, video, etc.
    field?(:metadata, String) # Such as allowed annotation types, domain specific data
    field?(:entries, Array, of: EntrySchema)
  end

  MediaSchema = Verse.define do
    field(:id, String) # PK
    field(:key, String) # PK
    field?(:blob_data, String) # BLOB
    field?(:media_type, String)
    field?(:metadata, String)
  end

  EntrySchema = Verse.define do
    field(:id, String) # PK, CHECK(length(id) <= 64)
    field(:media_url, String) # resource ?
    field?(:metadata, String)
    field?(:annotations, Array, of: AnnotationSchema)
  end

  AnnotationSchema = Verse.define do
    field(:id, String) # PK, CHECK(length(id) <= 64)
    field(:type, String) # Type of annotation, e.g., bounding_box, segmentation
    field(:dimensions, String)
    # field?(:annotation, String) # is this needed ?
    field?(:category, String)
    field?(:metadata, String)
  end

  MetadataSchema = Verse.define do
    field(:key, String) # PK, CHECK(length(id) <= 255)
    field(:value, String)
    # default: {type: datset, version: 1.0}
  end
end
