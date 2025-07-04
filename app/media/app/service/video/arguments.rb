# frozen_string_literal: true

module Video
  SCALE_FORMATS = {
    "240p" => [240, "400k", "96k"],
    "360p" => [360, "800k", "128k"],
    "480p" => [480, "1200k", "128k"],
    "720p" => [720, "2500k", "192k"],
    "1080p" => [1080, "5000k", "192k"],
    "1440p" => [1440, "10000k", "192k"],
    "2160p" => [2160, "20000k", "192k"],
  }.freeze

  ArgumentsSchema = Verse::Schema.define do
    field :resource, String, required: true

    field(:sizes,
          Array,
          of: String,
          default: SCALE_FORMATS.keys,
          desc: "List of video sizes to generate. Default is [360p, 480p, 720p, 1080p]."
    ).rule("must match compatible formats") do |v|
      v.all?{ |size| SCALE_FORMATS.key?(size) }
    end

    # Generate frames
    field :generate_frames, TrueClass, default: false, desc: "Generate and store frames from the video. Default is false."
    field :generate_frame_framerate, Integer, default: 6, desc: "Fps of the generated frames. Default is 6 fps."
    field :generate_frame_format, String, default: "avif", desc: "Format of the generated frames. Supported formats: avif, webp, jpg, png"

    # Streaming options
    field :streaming_enable_m3u8, TrueClass, default: true, desc: "Enable HLS streaming with m3u8 playlist. Will create the different files. Default is true."
    field :streaming_time_per_segment, Integer, default: 10, desc: "Time per segment in seconds for HLS streaming. Default is 10 seconds."

    # Generate the navigation thumbnail
    field :generate_thumbnail, TrueClass, default: true, desc: "Generate a navigable thumbnail by aggregating 10 frames from the video. Default is true."
  end

  Arguments = ArgumentsSchema.dataclass
end
