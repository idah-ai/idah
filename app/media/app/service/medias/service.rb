# frozen_string_literal: true

require "zip"

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

    def upload(file, resource:, project_id:, key: "")
      results = []
      if zip_file?(file)
        Zip::File.open(file.tempfile.path) do |zip|
          zip.each do |zip_entry|
            next if system_artifact?(zip_entry)

            ext = File.extname(zip_entry.name).downcase

            new_resource = "#{SecureRandom.hex(8)}#{ext}"

            Tempfile.create(["zip_extract", ext], binmode: true) do |tmp|
              # zip_entry.extract(tmp.path) { true }
              zip_entry.get_input_stream { |stream| IO.copy_stream(stream, tmp) }
              tmp.rewind
              extracted_file = Verse::Http::UploadedFileStruct.new(
                {
                  filename: File.basename(zip_entry.name),
                  tempfile: tmp
                }
              )

              results << store_media(file: extracted_file, resource: new_resource, key:, project_id:)
            end
          end
        end
      else
        # Verify that the resource/key combination is not already used:
        existing = medias.find_by({ resource:, key: })

        # TODO: consider regenerating the resource ?
        if existing
          raise Verse::Error::ValidationFailed,
                "Resource #{resource} with key #{key} already exists"
        end

        results << store_media(file:, resource:, key:, project_id:)
      end

      results
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

    def store_media(file:, resource:, key:, project_id:)
      Verse::Plugin[:shrine].with_storage do |storage|
        # Upload the file to the storage:
        output = storage.upload(file.tempfile)

        medias.create(
          {
            id: output.id,
            resource:,
            filename: file.filename || resource,
            key:,
            size: output.size,
            mime_type: output.mime_type || "application/octet-stream",
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
