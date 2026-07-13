# frozen_string_literal: true

require "zip"
require "rack/mime"

module Medias
  class Service < Verse::Service::Base
    use medias: Medias::Repository

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
      errored = []

      if zip_file?(file)
        begin
          Zip::File.open_buffer(file.tempfile) do |zip|
            # Pass 1 (scan_zip_entries) inspects headers only and rejects bombs
            # before anything is extracted; pass 2 extracts only the survivors.
            scan_zip_entries(zip, skipped).each do |zip_entry|
              ext = File.extname(zip_entry.name).downcase

              entry_io = StreamWithPath.new(
                zip_entry.get_input_stream,
                File.basename(zip_entry.name)
              )

              begin
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
                  # store_media returns a reason string when the file is intentionally rejected
                  skipped << { filename: zip_entry.name, message: result }
                end
              rescue StandardError => e
                # A failing entry must not abort the rest of the archive
                errored << { filename: zip_entry.name, message: e.message }
              end
            end
          end
        rescue Zip::Error
          raise Verse::Error::ValidationFailed, "Invalid or corrupted zip archive"
        end
      else
        # Verify that the resource/key combination is not already used
        if medias.find_by({ resource:, key: })
          raise Verse::Error::ValidationFailed,
                "Resource #{resource} with key #{key} already exists"
        end

        if file.tempfile.size > UploadConstants::MAX_ENTRY_UNCOMPRESSED_SIZE
          skipped << { filename: file.filename, message: file_too_large_message }
        else
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
      end

      { processed: results, skipped: skipped, errored: errored }
    end

    private

    # Returns true when the file is a zip archive.
    def zip_file?(file)
      ["application/zip", "application/x-zip-compressed"].include?(file.type.to_s) ||
        File.extname(file.filename.to_s).downcase == ".zip"
    end

    # Pass 1: inspect entry headers only (no decompression) to reject zip bombs
    # before extracting anything. The compression-ratio and total-uncompressed
    # guards reject the whole archive (raise); a single oversized entry is added
    # to +skipped+ and excluded. Returns the entries to extract in pass 2.
    def scan_zip_entries(zip, skipped)
      to_process = []
      total_uncompressed = 0

      zip.each do |entry|
        next if system_artifact?(entry) # also filters directories

        if entry.compressed_size.positive? &&
           entry.size.to_f / entry.compressed_size > UploadConstants::MAX_COMPRESSION_RATIO
          raise Verse::Error::ValidationFailed,
                "Zip archive rejected: '#{entry.name}' has a suspicious compression ratio"
        end

        if entry.size > UploadConstants::MAX_ENTRY_UNCOMPRESSED_SIZE
          skipped << { filename: entry.name, message: file_too_large_message }
          next # not extracted, so it must not count toward the total
        end

        total_uncompressed += entry.size
        if total_uncompressed > UploadConstants::MAX_TOTAL_UNCOMPRESSED_SIZE
          raise Verse::Error::ValidationFailed,
                "Zip archive rejected: total uncompressed size exceeds the " \
                "#{human_size(UploadConstants::MAX_TOTAL_UNCOMPRESSED_SIZE)} limit"
        end

        to_process << entry
      end

      to_process
    end

    def file_too_large_message
      "File too large (max #{human_size(UploadConstants::MAX_ENTRY_UNCOMPRESSED_SIZE)} per file)"
    end

    # Human-readable byte size for error messages, e.g. 1073741824 -> "1 GB".
    def human_size(bytes)
      units = [["GB", 1024 ** 3], ["MB", 1024 ** 2], ["KB", 1024]]
      unit, divisor = units.find { |_, size| bytes >= size } || ["bytes", 1]
      "#{bytes / divisor} #{unit}"
    end

    def system_artifact?(entry)
      return true unless entry.file?

      basename = File.basename(entry.name)

      return true if (entry.name.split("/") & UploadConstants::SYSTEM_ARTIFACT_DIRS).any?
      return true if UploadConstants::SYSTEM_ARTIFACT_FILES.include?(basename)

      # macOS AppleDouble resource forks ("._filename") may also appear loose,
      # outside the __MACOSX container.
      basename.start_with?("._")
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
