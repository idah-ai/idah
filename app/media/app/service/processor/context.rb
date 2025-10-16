# frozen_string_literal: true

module Processor
  class Context
    attr_reader :resource, :config, :job

    def initialize(auth_context, job, resource, config)
      @auth_context = auth_context
      @job = job
      @resource = resource
      @config = config
    end

    def download_original
      media = medias.find_by(
        { resource: @resource, key: "" }
      )

      raise "media not found" unless media

      Verse.logger.info{ "Downloading media #{media.id} (#{media.key})" }

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

    def upload_media(io, key, mime_type)
      io = StringIO.new(io) if io.is_a?(String)

      medias.transaction do
        record = medias.find_by(
          {
            resource: arguments.resource,
            key: key
          }
        )

        if record
          Verse.logger.info{
            "Media #{resource}/#{key} already exists, skipping upload"
          }
          return
        end

        Verse.logger.debug{
          "Uploading #{resource}/#{key} with mime_type #{mime_type}"
        }

        Verse::Plugin[:shrine].with_storage do |storage|
          file = storage.upload(io)

          medias.table.db.after_rollback do
            Verse.logger.warn{
              "Rollback called, deleting `#{resource}/#{key}` from storage"
            }
            storage.delete(file.id) if file
          end

          medias.create(
            {
              id: file.id,
              resource: resource,
              key: key,
              filename: File.basename(file_path),
              size: file.size,
              mime_type: mime_type || file.mime_type,
              project_id: "1",
              created_by: nil,
              created_role: "processor"
            }
          )
        end
      end
    end

    def progress=(progress)
      job.update_progress(progress)
    end

    def reschedule!(after: 10)
      job.reschedule!(after:)
    end

    def error!(message)
      job.error(message)
    end

    private

    def medias
      @medias ||= Medias::Repository.new(@auth_context)
    end
  end
end
