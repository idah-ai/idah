module Jobs
  module Video

    ArgumentsSchema = Verse::Schema.define do
      field :media_id, type: String, required: true

      field :generate_frames, type: Boolean, default: false
      field :generate_frame_framerate, type: Integer, default: 6
    end

    class Job < Jobs::Base

      def medias
        @medias ||= Medias::Repository.new
      end

      def initialize(arguments = {})
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
        @local_media_path = Verse::Media.download(media.key)
      end
    end
  end
end