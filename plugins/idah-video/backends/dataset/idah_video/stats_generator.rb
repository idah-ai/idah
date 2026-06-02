# frozen_string_literal: true

module IdahVideo
  class StatsGenerator
    # Prefix used in annotation dimensions[:type] values for this modality.
    MODALITY_PREFIX = "idah-video:"

    # Called by EntryStats::Recompute for every entry whose dataset modality
    # is "idah-video". Emits modality-specific stats via the provided emit lambda.
    #
    # Stats produced:
    #   "shape.<type>.count"      → count of annotations per shape type
    #                               (e.g. "shape.bounding-box.count")
    #   "video.duration_seconds"  → video duration from media metadata
    #   "video.fps"               → frames per second from media metadata
    #   "video.frame_count"       → computed as (duration * fps).round
    #
    # @param entry [Entry::Record] entry with dataset and project preloaded
    # @param emit  [Proc]          call with (key, value) to contribute a stat
    def self.generate(entry, emit)
      emit_shape_stats(entry, emit)
      emit_video_stats(entry, emit)
    end

    # Count annotations by shape type, stripping the "idah-video:" modality
    # prefix so the key reads as "shape.bounding-box.count" etc.
    # Uses the already-preloaded entry.annotations to avoid a nil auth context query.
    def self.emit_shape_stats(entry, emit)
      annotations = entry.annotations || []

      shape_counts = Hash.new(0)
      annotations.each do |annotation|
        type = annotation.dimensions&.dig(:type)
        next unless type

        shape_key = type.delete_prefix(MODALITY_PREFIX)
        shape_counts[shape_key] += 1
      end

      shape_counts.each do |shape, count|
        emit.call("shape.#{shape}.count", count)
      end
    end

    # Fetch video metadata from the media service and emit duration / fps /
    # total frame count. Silently skips if media info is unavailable.
    #
    # resource_info called without a key defaults to the empty-key record,
    # which is the original upload and the only record with fps/duration meta.
    # The meta field is stored as a JSON string in the DB, so we parse it.
    def self.emit_video_stats(entry, emit)
      entry_media = Api[:idah].media.medias.resource_info(resource: entry.resource)
      meta = entry_media.data[:attributes][:meta]

      return unless meta.any?

      duration = meta[:duration].to_f
      fps      = meta[:fps].to_f

      emit.call("video.duration_seconds", duration)
      emit.call("video.fps", fps)
      emit.call("video.frame_count", (duration * fps).round)
    rescue StandardError => e
      Verse.logger.warn(
        "[IdahVideo::StatsGenerator] Could not fetch video metadata for entry #{entry.id}: " \
        "#{e.class} — #{e.message}\n#{e.backtrace.first(3).join("\n")}"
      )
    end
  end
end
