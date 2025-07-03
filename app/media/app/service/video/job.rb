# frozen_string_literal: true

module Video
  class Job < Jobs::Base
    def medias
      @medias ||= Medias::Repository.new
    end

    def initialize(arguments = {})
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
  end
end
