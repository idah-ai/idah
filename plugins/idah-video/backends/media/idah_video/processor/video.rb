# frozen_string_literal: true

module IdahVideo
  module Processor
    class Video
      attr_reader :context

      def initialize(context)
        @context = context
      end

      def run
        file_path = context.download_original

        video_info = VideoInfo.from_file(file_path)

        process_media(file_path, video_info) do |output|
          # Upload the master manifest
          context.upload_media(
            output.master_m3u8, "master.m3u8", "application/vnd.apple.mpegurl"
          )

          output.streams.each do |stream|
            # Upload the different streams manifests
            context.upload_media(
              stream.m3u8, File.basename(stream.m3u8), "application/vnd.apple.mpegurl"
            )

            # Upload the stream fragments
            stream.fragments.each do |fragment|
              context.upload_media(
                fragment, File.basename(fragment), "video/mp2t"
              )
            end
          end

          if context.options.generate_thumbnail
            GenerateThumbnail.call(
              file_path,
              video_info,
              tmpdir: output.tmpdir
            ) do |thumbnail|
              context.upload_media(
                File.open(thumbnail),
                "thumbnail.jpg",
                "image/jpeg"
              )
            end
          end
        end
      ensure
        File.delete(file_path) if file_path && File.exist?(file_path)
      end

      protected

      def process_media(file_path, video_info, &block)
        Verse.logger.info{ "[IdahVideo] Processing media #{arguments.resource}..." }

        unless block_given?
          raise ArgumentError, "no block given"
        end

        last_progress = 0

        GenerateStreaming.call(file_path, video_info, context.options) do |progress, output|
          now = Time.now.to_i

          # Do not update too frequently (update to db)
          if now - last_progress > 5 || progress == 1.0
            last_progress = now
            context.progress = progress * 0.99 # 99% to convert, 1% to upload.
          end

          if output
            block.call(output)
            context.progress = 1.0
          end
        end
      end
    end
  end
end
