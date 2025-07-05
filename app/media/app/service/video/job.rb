# frozen_string_literal: true

module Video
  class Job < Jobs::Base
    def medias
      @medias ||= Medias::Repository.new(Verse::Auth::Context.new)
    end

    def initialize(job_id, arguments = {})
      super
      @arguments = Arguments.new(arguments)
    end

    def run_impl
      # Store the media locally
      file_path = download_media

      # Process the media
      output = process_media(file_path)

      upload_files(output)
    end

    protected

    def download_media
      media = medias.find_by(
        {
          resource: arguments.resource,
          key: ""
        }
      )

      raise "media not found" unless media

      Verse.logger.info "Downloading media #{media.id} (#{media.key})"

      # Assuming we have a method to download the media
      Verse::Plugin[:shrine].with_storage do |storage|
        file = storage.open(media.id)

        # Copy the file to a temporary location:
        tempfile = Tempfile.create("idah_media_#{media.id}_", binmode: true)

        tempfile.write(file.read)
        tempfile.close

        tempfile.path
      end
    end

    def upload_files(output)
      upload_file(
        output.master_m3u8,
        "master.m3u8",
        "application/vnd.apple.mpegurl"
      )

      output.streams.each do |stream|
        upload_file(
          stream.m3u8,
          File.basename(stream.m3u8),
          "application/vnd.apple.mpegurl"
        )

        stream.fragments.each do |fragment|
          upload_file(
            fragment,
            File.basename(fragment),
            "video/mp2t"
          )
        end
      end
    end

    def upload_file(file_path, key, mime_type)
      medias.transaction do
        Verse.logger.debug{
          "Uploading #{file_path} to #{arguments.resource}/#{key} with mime_type #{mime_type}"
        }

        record = medias.find_by(
          {
            resource: arguments.resource,
            key: key
          }
        )

        return if record

        Verse::Plugin[:shrine].with_storage do |storage|
          file = storage.upload(
            File.new(file_path)
          )

          medias.table.db.after_rollback do
            Verse.logger.warn{
              "Failed to upload #{file_path} to #{arguments.resource}/#{key}, deleting file from storage"
            }
            storage.delete(file.id) if file
          end

          medias.create(
            {
              id: file.id,
              resource: arguments.resource,
              key: key,
              filename: File.basename(file_path),
              size: file.size,
              mime_type:,
              created_by: nil,
              created_role: "system"
            }
          )
        end
      end
    end

    def process_media(file_path)
      Verse.logger.info{ "Processing media #{arguments.resource}..." }

      last_progress = Time.now.to_i

      Video::GenerateStreaming.generate(
        file_path,
        arguments
      ) do |progress|
        now = Time.now.to_i

        # Do not update too frequently (call to db)
        if now - last_progress > 10
          last_progress = now
          update_progress(progress * 0.9) # 90% to convert, 10% to upload
        end
      end
    end
  end
end
