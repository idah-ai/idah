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

    def run
      # Store the media locally
      download_media

      # Process the media
      process_media

      # Upload the processed media
      upload_media
    end

    protected

    def download_media
      media = medias.find(arguments.media_id)

      raise "media not found" unless media

      Verse.logger.info "Downloading media #{media.id} (#{media.key})"

      # Assuming we have a method to download the media
      Verse::Plugins[:shrine].with_storage do |storage|
        file = storage.open(file_info.id)
        # Copy the file to a temporary location:
        temp_file_path = File.join(
          Dir.tmpdir,
          file_info.key
        )

        temp_file_path
      ensure
        file.close
      end
    end

    def upload_file(file_path, key, mime_type)
      # Upload the master m3u8 file:
      medias.transaction do
        # master.m3u8
        record = medias.find_by(
          {
            resource: arguments.resource,
            key: "master.m3u8"
          }
        )

        return if record

        file = storage.upload(
          File.new(file_path)
        )

        medias.db.after_rollback do
          storage.delete(file.id) if file
        end

        medias.create(
          {
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

    def process_media
      Verse.logger.info "Processing media #{arguments.media_id}"

      Time.now.utc

      output = Video::GenerateStreaming.generate(
        file_path,
        arguments
      ) do |progress|
      end

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

        fragments.each do |fragment|
          upload_file(
            fragment.path,
            File.basename(fragment.path),
            "video/mp2t"
          )
        end
      end
    end
  end
end
