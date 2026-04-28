# frozen_string_literal: true

module IdahVideo
  module Processor
    SCALE_FORMATS = {
      "240p" => [240, "400k", "96k"],
      "360p" => [360, "800k", "128k"],
      "480p" => [480, "1200k", "128k"],
      "720p" => [720, "2500k", "192k"],
      "1080p" => [1080, "5000k", "192k"],
      "1440p" => [1440, "10000k", "192k"],
      "2160p" => [2160, "20000k", "192k"],
    }.freeze

    OptionsSchema = Verse::Schema.define do
      field(
        :sizes,
        Array,
        of: String,
        # Default up to 1080p.
        # The reason is in most projects, 1080p should be enough;
        # it reduces memory when re-encoding allowing deployment to smaller servers.
        default: ["240p", "360p", "480p", "720p", "1080p"],
        desc: "List of video sizes to generate. Default is [240p, 360p, 480p, 720p, 1080p]."
      ).rule("must match compatible formats") do |v|
        v.all?{ |size| SCALE_FORMATS.key?(size) }
      end

      # Generate frames. Not implemented yet.
      field :generate_frames,
            TrueClass,
            default: false,
            desc: "Generate and store frames from the video. Default is false."
      field :generate_frame_framerate, Integer, default: 6, desc: "Fps of the generated frames. Default is 6 fps."
      field :generate_frame_format,
            String,
            default: "avif",
            desc: "Format of the generated frames. Supported formats: avif, webp, jpg, png"

      field :streaming_time_per_segment,
            Integer,
            default: 2,
            desc: "Time per segment in seconds for HLS streaming. Default is 2 seconds."

      # Generate the navigation thumbnail
      field :generate_thumbnail,
            TrueClass,
            default: true,
            desc: "Generate a navigable thumbnail by aggregating 10 frames from the video. Default is true."
    end
  end
end
