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
          ]

    field :generate_frames, Boolean, default: false
    field :generate_frame_framerate, Integer, default: 6

    field :generate_thumbnail, Boolean, default: true
  end

  Arguments = ArgumentsSchema.dataclass
end
