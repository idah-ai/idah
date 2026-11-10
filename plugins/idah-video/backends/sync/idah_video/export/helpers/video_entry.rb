# frozen_string_literal: true

require "tempfile"

module IdahVideo
  module Export
    module Helpers
      # One entry's video, read for export: its name and size, its shapes frame
      # by frame in pixels, and its tags.
      #
      # IDAH stores a shape's keyframes only; the frames in between are computed
      # with the frontend's interpolation (Interpolator), so each frame lists
      # every shape visible on it, as annotators saw it. What cannot be exported
      # is counted in the report.
      class VideoEntry
        ENTRY_ROOT = "entry:root"
        FRAME_TAG = "idah-video:frame"
        BOUNDING_BOX = Interpolator::BOUNDING_BOX
        POLYGON = Interpolator::POLYGON

        # A box or polygon on one frame. `points` is its outline in pixels,
        # rotated as drawn and clamped to the frame; `angle` the box's rotation
        # in radians; `keyframe` whether it is stored in IDAH or computed.
        Shape = Data.define(:record, :points, :angle, :keyframe)

        attr_reader :entry, :name, :meta, :width, :height, :shapes, :shape_records, :frame_tags, :entry_tags

        def initialize(entry, report)
          @entry = entry
          @report = report
          # The original upload holds the video's width, height, fps and duration.
          @media = entry.medias({ key: "" }).first
          @meta = Keys.symbolize(@media&.record&.data&.dig(:attributes, :meta) || {})
          # Entries can have no name; the uploaded file's name stands in for it.
          @name = [entry.record.name, @media&.record&.data&.dig(:attributes, :filename), entry.record.id]
                  .map(&:to_s).find { |value| !value.empty? }
          @width = @meta[:width].to_i
          @height = @meta[:height].to_i
          @shapes = Hash.new { |hash, frame| hash[frame] = [] }
          @shape_records = [] # boxes and polygons with a category, in annotation order
          @frame_tags = Hash.new { |hash, frame| hash[frame] = [] }
          @entry_tags = []
        end

        # Reads the entry's annotations. Returns false, with a warning, when the
        # video's size is unknown: shapes cannot be placed in pixels.
        def load
          unless width.positive? && height.positive?
            @report.warn("Entry `#{name}` (#{entry.record.id}) skipped: video width and height are unknown.")
            return false
          end

          entry.annotations.each { |annotation| collect(annotation.record) }
          true
        end

        # Frames with a shape or a frame tag, in order.
        def frames = (shapes.keys | frame_tags.keys).sort

        # Same frame count as the frontend: floor(duration * fps).
        def length
          fps = meta[:fps]&.to_f
          duration = meta[:duration]&.to_f
          (duration * fps).floor if fps && duration
        end

        # Extracts `frames` from the original video as `frame_NNNNNN.jpg` in
        # `directory`. A video that cannot be read keeps its labels; the report
        # says why its images are missing.
        def write_images(frames, directory)
          Tempfile.create(["idah-video", File.extname(name)]) do |file|
            file.binmode
            file.write(@media.download)
            file.flush

            written = FrameExtractor.extract(file.path, frames, directory)
            @report.count(:image_files, written.size)

            missing = frames.size - written.size
            next unless missing.positive?

            @report.warn(
              "Entry `#{name}` (#{entry.record.id}): #{missing} frames past the end of the video have no image."
            )
          end
        rescue StandardError => e
          Verse.logger&.warn { "Video export: no images for entry #{entry.record.id}: #{e.message}" }
          @report.warn("Entry `#{name}` (#{entry.record.id}): no images, the video could not be read (#{e.class}).")
        end

        private

        def collect(record)
          return @report.skip(:deleted) if record.data[:attributes][:deleted_at]

          case record.shape_type
          when ENTRY_ROOT
            @entry_tags << record
          when FRAME_TAG
            @frame_tags[tag_frame(record)] << record
          when BOUNDING_BOX, POLYGON
            return @report.skip(:no_category) if record.category.nil? || record.category.to_s.empty?

            collect_shape(record)
          else
            @report.skip("unsupported_shape_type:#{record.shape_type}")
          end
        end

        # The shape on every frame it is drawn on: its keyframes and every frame
        # between two of them.
        def collect_shape(record)
          shape_args = Keys.symbolize(record.shape_args || {})
          keyframes = Array(shape_args[:frames]).map { |f| f[:frame] }
          return @report.skip(:no_keyframes) if keyframes.empty?

          @shape_records << record
          first = [keyframes.min, shape_args[:start]].compact.max
          last = [keyframes.max, shape_args[:end]].compact.min

          (first..last).each do |frame|
            geometry = Interpolator.at(record.shape_type, shape_args, frame)
            next unless geometry
            # Tools read a 2-point "polygon" as a box.
            next @report.skip(:too_few_points) if geometry.points.size < 3

            points = outline(geometry)
            # Drawn outside the video: clamping flattens it to a line or a point.
            next @report.skip(:zero_area) if Geometry.polygon_area(points).zero?

            @shapes[frame] << Shape.new(record:, points:, angle: geometry.angle, keyframe: geometry.keyframe)
          end
        end

        # In pixels, a rotated box turned around its centre as the frontend
        # draws it, clamped to the frame.
        def outline(geometry)
          points = Geometry.to_pixels(geometry.points, width, height)
          points = Geometry.rotate(points, geometry.angle) unless geometry.angle.zero?
          Geometry.clamp(points, width, height)
        end

        def tag_frame(record)
          shape_args = Keys.symbolize(record.shape_args || {})
          shape_args[:start] || Array(shape_args[:frames]).first&.dig(:frame)
        end
      end
    end
  end
end
