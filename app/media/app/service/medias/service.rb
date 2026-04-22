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
        Zip::File.open(file.tempfile.path) do |zip|
          zip.each do |zip_entry|
            next if system_artifact?(zip_entry)

            ext = File.extname(zip_entry.name).downcase
            new_resource = "#{SecureRandom.hex(8)}#{ext}"

            Tempfile.create(["zip_extract", ext], binmode: true) do |tmp|
              zip_entry.get_input_stream { |stream| IO.copy_stream(stream, tmp) }
              tmp.rewind

              # identify a mime_type from extension, as this file is extracted
              mime_type = Rack::Mime.mime_type(ext, "application/octet-stream")

              extracted_file = Verse::Http::UploadedFileStruct.new(
                {
                  filename: File.basename(zip_entry.name),
                  type: mime_type,
                  tempfile: tmp,
                }
              )

              if (res = store_media(file: extracted_file, resource: new_resource, key:, project_id:, modality:))
                results << res
              else
                skipped << zip_entry.name
              end
            end
          end
        end
      else
        # Verify that the resource/key combination is not already used
        if medias.find_by({ resource:, key: })
          raise Verse::Error::ValidationFailed,
                "Resource #{resource} with key #{key} already exists"
        end

        if (res = store_media(file:, resource:, key:, project_id:, modality:))
          results << res
        else
          skipped << file.filename
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

    def store_media(file:, resource:, key:, project_id:, modality: nil)
      # Check if the modality allows this mime type BEFORE uploading
      if modality &&
         (allowed = Processor::Registry.allowed_mime_types(modality)) &&
         allowed.none? { |pattern| file.type =~ Regexp.new(pattern) }
        return nil
      end

      Verse::Plugin[:shrine].with_storage do |storage|
        # Upload the file to the storage ONLY AFTER passing validation:
        output = storage.upload(file.tempfile)

        medias.create(
          {
            id: output.id,
            resource:,
            filename: file.filename || resource,
            key:,
            size: output.size,
            mime_type: file.type,
            created_by: auth_context.metadata[:id],
            created_role: auth_context.metadata[:role]&.to_s,
            project_id:
          }
        )
        medias.find!(output.id)
      end
    end
  end
end
