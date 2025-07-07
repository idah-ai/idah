module Video
  module GenerateStreaming
    module_function

    def generate(file_path, video_info)
      dir = Dir.mktmpdir("idah_vp")

      command =
        "ffmpeg -i %{file_path} "\
        "-vf select=no(mod(n\,floor(n_frames/10))),scale=240:-1 "\
        "-vsync vfr -frames:v 10 -q:v 2 "\
        "%02d.png -y"
    end

  end
end
