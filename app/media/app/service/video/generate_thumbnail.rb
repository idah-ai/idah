module Video
  module GenerateThumbnail
    module_function

    def call(file_path, video_info, tmpdir: nil)
      file_path = File.absolute_path(file_path)
      tmpdir ||= Dir.mktmpdir("idah_vp")

      # 10 images during the whole duration of the video
      images = "10/#{video_info.duration}"

      command =
        "ffmpeg -i %{file_path} "\
        "-vf 'fps=#{images},scale=240:-1' "\
        "-fps_mode vfr -frames:v 10 -q:v 2 "\
        "thumb_%%02d.png -y"

      # No progress output
      EXECUTOR.call(
        command, chdir: tmpdir,
        file_path:
      )

      compose(tmpdir)
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
          idx * width, 0,
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
