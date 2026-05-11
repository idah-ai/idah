# frozen_string_literal: true

require "zip"
require "rack/mime"

module Medias
  class Service < Verse::Service::Base
    use medias: Medias::Repository
    use_system video_service: Video::Service

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      medias.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(resource, key, included: [])
      medias.find_by!({ resource:, key: }, included:)
    end

    # TODO: check who can delete ? only system ?
    def delete(resource, key)
      file = medias.find_by!({ resource:, key: })
      medias.delete(file.id)
    end

    def create(record)
      medias.transaction do
        record_id = medias.create(record.attributes)
        medias.find!(record_id)
      end
    end

    def upload(file, resource:, project_id:, key: "", modality: nil)
      # satisfy the mandatory context check, in case the repository is never hit, avoid throwing an error
      medias.scoped(:create)

      results = []
      skipped = []

      if zip_file?(file)
        Zip::File.open_buffer(file.tempfile) do |zip|
          zip.each do |zip_entry|
            next if system_artifact?(zip_entry) # skip unrelated artifacts in compressed

            ext = File.extname(zip_entry.name).downcase

            entry_io = StreamWithPath.new(
              zip_entry.get_input_stream,
              File.basename(zip_entry.name)
            )

            result = store_media(
              io: entry_io, # Stream directly from zip entry to storage - no tempfiles
              filename: File.basename(zip_entry.name),
              size: zip_entry.size,
              mime_type: Rack::Mime.mime_type(ext, "application/octet-stream"),
              resource: "#{SecureRandom.hex(8)}#{ext}",
              key:,
              project_id:,
              modality:
            )

            if result.is_a?(Medias::Record)
              results << result
            else
              skipped << { filename: zip_entry.name, message: result }
            end
          end
        end
      else
        # Verify that the resource/key combination is not already used
        if medias.find_by({ resource:, key: })
          raise Verse::Error::ValidationFailed,
                "Resource #{resource} with key #{key} already exists"
        end

        result = store_media(
          io: file.tempfile,
          filename: file.filename,
          mime_type: file.type,
          resource:,
          key:,
          project_id:,
          modality:
        )

        if result.is_a?(Medias::Record)
          results << result
        else
          skipped << { filename: file.filename, message: result }
        end
      end

      { processed: results, skipped: skipped }
    end

    private

    # Returns true when the file is a zip archive.
    def zip_file?(file)
      ["application/zip", "application/x-zip-compressed"].include?(file.type.to_s) ||
        File.extname(file.filename.to_s).downcase == ".zip"
    end

    # OS-generated metadata entries that should be silently ignored when
    # extracting a zip archive. No zip library handles this automatically —
    # it is the application's responsibility.
    SYSTEM_ARTIFACT_PATHS = [
      "__MACOSX/",   # macOS AppleDouble container (._filename sidecars)
      ".DS_Store",   # macOS folder-view settings
      "Thumbs.db",   # Windows thumbnail cache
      "desktop.ini"  # Windows folder configuration
    ].freeze

    def system_artifact?(entry)
      return true unless entry.file?

      SYSTEM_ARTIFACT_PATHS.any? { |pattern| entry.name.include?(pattern) }
    end

    def store_media(io:, filename:, mime_type:, resource:, key:, project_id:, size: nil, modality: nil)
      # Check if the modality allows this mime type BEFORE uploading
      if modality &&
         (allowed = Processor::Registry.allowed_mime_types(modality)) &&
         allowed.none? { |pattern| mime_type =~ Regexp.new(pattern) }
        return "File type is not supported"
      end

      Verse::Plugin[:shrine].with_storage do |storage|
        output = storage.upload(io)

        medias.create(
          {
            id: output.id,
            resource:,
            filename: filename || resource,
            key:,
            size: size || output.size,
            mime_type:,
            created_by: auth_context.metadata[:id],
            created_role: auth_context.metadata[:role]&.to_s,
            project_id:
          }
        )
        medias.find!(output.id)
      end
    end
  end

  # Wrapper to provide path metadata for streams (Shrine needs this to determine file extension)
  StreamWithPath = Struct.new(:io, :path) do
    def respond_to_missing?(method, include_all = false)
      io.respond_to?(method, include_all) || super
    end

    def method_missing(method, *args, &block)
      if io.respond_to?(method)
        io.send(method, *args, &block)
      else
        super
      end
    end
  end
end
