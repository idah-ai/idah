# frozen_string_literal: true

require "tmpdir"
require "fileutils"

# Stand-in for the sync service's Exports::Context, with the same interface the
# exporters use: datasets -> entries -> annotations / medias, options, and
# io.directory. Records answer attribute methods and `data[:attributes]`, like
# the Verse::JsonApi::Struct records the sync service hands out.
class FakeExportContext
  attr_reader :options, :io, :datasets

  def initialize(datasets:, options: {})
    @datasets = datasets
    @options = options
    @io = FakeIo.new
  end

  def cleanup = io.cleanup

  class FakeIo
    def directory
      @directory ||= Dir.mktmpdir("idah-export-")
    end

    def cleanup
      FileUtils.rm_rf(@directory) if @directory
    end
  end

  class Record
    attr_reader :id, :data

    def initialize(id, attributes)
      @id = id
      @attributes = attributes
      @data = { id:, attributes: }
    end

    def method_missing(name, *args)
      return @attributes[name] if args.empty? && @attributes.key?(name)

      super
    end

    def respond_to_missing?(name, include_private = false)
      @attributes.key?(name) || super
    end
  end

  class Dataset
    attr_reader :record, :entry_filters

    def initialize(id:, entries:, modality: "idah-image", name: "Dataset", labeling_configuration: {})
      @record = Record.new(id, { name:, modality:, labeling_configuration: })
      @entries = entries
      @entry_filters = []
    end

    # Applies a `status:` filter like the dataset service would.
    def entries(filter = {})
      @entry_filters << filter
      @entries.select { |entry| filter[:status].nil? || entry.record.status == filter[:status] }
    end
  end

  class Entry
    attr_reader :record

    def initialize(id:, name:, annotations: [], meta: { width: 1000, height: 500 },
                   status: "completed", filename: "upload.jpg", file: nil)
      @record = Record.new(id, { name:, status:, resource: "#{id}.jpg" })
      @annotations = annotations
      @medias = meta ? [Media.new(meta, filename, file)] : []
    end

    def annotations(_filter = {}) = @annotations

    def medias(_filter = {}) = @medias
  end

  class Media
    attr_reader :record

    def initialize(meta, filename, file)
      @record = Record.new("media", { key: "", meta:, filename: })
      @file = file
    end

    # The file's bytes, read from the `file:` path given to the entry.
    def download = File.binread(@file)
  end

  class Annotation
    attr_reader :record

    def initialize(id:, shape_type:, shape_args:, category: nil, properties: {}, metadata: {}, deleted_at: nil,
                   created_at: nil)
      @record = Record.new(
        id,
        { shape_type:, shape_args:, category:, properties:, metadata:, deleted_at:, created_at: }
      )
    end
  end
end
