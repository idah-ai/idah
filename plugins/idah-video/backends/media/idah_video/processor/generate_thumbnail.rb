# frozen_string_literal: true

module IdahVideo
  module Processor
    module GenerateThumbnail
      module_function

      def call(file_path, video_info, tmpdir: nil)
        file_path = File.absolute_path(file_path)
        tmpdir ||= Dir.mktmpdir("idah-vp-")

        # 10 images during the whole duration of the video
        fps = "10/#{video_info.duration}"

        Ffmpeg.gen_thumbnail(
          file_path,
          fps,
          tmpdir,
          images: 10,
          scale: "240:-1",
          output: "thumb_%02d.png"
        )

        yield compose(tmpdir)
      ensure
        # Clean up the temporary directory
        FileUtils.rm_rf(tmpdir) if tmpdir && File.exist?(tmpdir)
      end

      def compose(tmpdir)
        output = File.join(tmpdir, "thumbnail.jpg")

        images = Dir.glob(File.join(tmpdir, "thumb_*.png")).sort.map do |file|
          Magick::Image.read(file).first
        end

        width = images.first.columns
        height = images.first.rows
        canvas = Magick::Image.new(width * images.size, height)

        images.each_with_index do |img, idx|
          canvas.composite!(
            img,
            Magick::NorthWestGravity,
            idx * width,
            0,
            Magick::OverCompositeOp
          )
        end

        canvas.write(output){ |img| img.quality = 80 }

        canvas.destroy! # Clean up memory
        images.each(&:destroy!) # Clean up memory

        output
      end
    end
  end
end
