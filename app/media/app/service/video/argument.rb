# frozen_string_literal: true

module Video
  ArgumentsSchema = Verse::Schema.define do
    field :media_id, String, required: true

    field :sizes,
          Array,
          of: String,
          default: [
            "360p",
            "480p",
            "720p",
            "1080p",
          ],
          desc: "List of video sizes to generate. Default is [360p, 480p, 720p, 1080p]."

    # Generate frames
    field :generate_frames, Boolean, default: false, desc: "Generate and store frames from the video. Default is false."
    field :generate_frame_framerate, Integer, default: 6, desc: "Fps of the generated frames. Default is 6 fps."
    field :generate_frame_format, String, default: "avif", desc: "Format of the generated frames. Supported formats: avif, webp, jpg, png"

    # Streaming options
    field :streaming_enable_m3u8, Boolean, default: true, desc: "Enable HLS streaming with m3u8 playlist. Will create the different files. Default is true."
    field :streaming_time_per_segment, Integer, default: 10, desc: "Time per segment in seconds for HLS streaming. Default is 10 seconds."

    # Generate the navigation thumbnail
    field :generate_thumbnail, Boolean, default: true, desc: "Generate a navigable thumbnail by aggregating 10 frames from the video. Default is true."
  end

  Arguments = ArgumentsSchema.dataclass
end
