# frozen_string_literal: true

require "fileutils"

module IdahImage
  module Export
    module Helpers
      # One entry's image, read for export: its name, size and original file,
      # its shapes in pixels, and its image-level tags. What cannot be exported
      # is counted in the report.
      class ImageEntry
        ENTRY_ROOT = "entry:root"
        BOUNDING_BOX = "idah-image:bounding-box"
        POLYGON = "idah-image:polygon"
        CIRCLE = "idah-image:circle"
        ELLIPSE = "idah-image:ellipse"
        MASK = "idah-image:mask"
        SHAPES = [BOUNDING_BOX, POLYGON, CIRCLE, ELLIPSE, MASK].freeze

        # A shape in pixels. `points` is its outline, rotated as drawn and
        # clamped to the image; a mask has none and gives its pixels in `mask`.
        # `angle` is the rotation of a box or an ellipse, in radians.
        Shape = Data.define(:record, :points, :angle, :mask) do
          def mask? = !mask.nil?
        end

        attr_reader :entry, :name, :width, :height, :shapes, :entry_tags

        def initialize(entry, report)
          @entry = entry
          @report = report
          # The original upload holds the image's width and height.
          @media = entry.medias({ key: "" }).first
          meta = Keys.symbolize(@media&.record&.data&.dig(:attributes, :meta) || {})
          # Entries can have no name; the uploaded file's name stands in for it.
          @name = [entry.record.name, filename, entry.record.id].map(&:to_s).find { |value| !value.empty? }
          @width = meta[:width].to_i
          @height = meta[:height].to_i
          @shapes = []
          @entry_tags = []
        end

        # Reads the entry's annotations. Returns false, with a warning, when the
        # image's size is unknown: shapes cannot be placed in pixels.
        def load
          unless width.positive? && height.positive?
            @report.warn("Entry `#{name}` (#{entry.record.id}) skipped: image width and height are unknown.")
            return false
          end

          entry.annotations.each { |annotation| collect(annotation.record) }
          true
        end

        def empty? = shapes.empty? && entry_tags.empty?

        # The original file's extension, such as ".png"; ".jpg" when unknown.
        def extension
          ext = File.extname(filename.to_s)
          ext = File.extname(entry.record.name.to_s) if ext.empty?
          ext.empty? ? ".jpg" : ext.downcase
        end

        # Copies the original upload, unchanged, to `path`. An image that cannot
        # be read keeps its labels; the report says why its file is missing.
        def write_image(path)
          FileUtils.mkdir_p(File.dirname(path))
          File.binwrite(path, @media.download)
          @report.count(:image_files)
        rescue StandardError => e
          Verse.logger&.warn { "Image export: no image for entry #{entry.record.id}: #{e.message}" }
          @report.warn("Entry `#{name}` (#{entry.record.id}): no image, the original could not be read (#{e.class}).")
        end

        private

        def filename = @media&.record&.data&.dig(:attributes, :filename)

        def collect(record)
          return @report.skip(:deleted) if record.data[:attributes][:deleted_at]

          if record.shape_type == ENTRY_ROOT
            @entry_tags << record
          elsif SHAPES.include?(record.shape_type)
            return @report.skip(:no_category) if record.category.nil? || record.category.to_s.empty?

            collect_shape(record)
          else
            @report.skip("unsupported_shape_type:#{record.shape_type}")
          end
        end

        def collect_shape(record)
          args = Keys.symbolize(record.shape_args || {})
          angle = args[:angle].to_f

          if record.shape_type == MASK
            mask = Mask.decode(args, width, height)
            return @report.skip(:zero_area) if mask.empty?

            return @shapes << Shape.new(record:, points: nil, angle: 0.0, mask:)
          end

          points = outline(record.shape_type, args, angle)
          # Tools read a 2-point "polygon" as a box.
          return @report.skip(:too_few_points) if points.nil? || points.size < 3

          points = Geometry.clamp(points, width, height)
          # Drawn outside the image: clamping flattens it to a line or a point.
          return @report.skip(:zero_area) if Geometry.polygon_area(points).zero?

          @shapes << Shape.new(record:, points:, angle:, mask: nil)
        end

        # The outline in pixels, a box or an ellipse turned around its centre
        # as the frontend draws it.
        def outline(shape_type, args, angle)
          points = Array(args[:points])

          case shape_type
          when BOUNDING_BOX
            rotated(Geometry.to_pixels(points, width, height), angle)
          when POLYGON
            Geometry.to_pixels(points, width, height)
          when CIRCLE
            return if points.empty?

            # The radius is a fraction of the image's shorter side.
            cx, cy = Geometry.to_pixels([points[0]], width, height).first
            radius = (args[:radius] || 0.1).to_f * [width, height].min
            Geometry.ellipse(cx, cy, radius, radius)
          when ELLIPSE
            return if points.empty?

            # Points are the centre, then the radii as fractions of the width
            # and height.
            cx, cy = Geometry.to_pixels([points[0]], width, height).first
            rx, ry = points[1] || [0.1, 0.05]
            rotated(Geometry.ellipse(cx, cy, rx.to_f * width, ry.to_f * height), angle)
          end
        end

        def rotated(points, angle)
          angle.zero? || points.empty? ? points : Geometry.rotate(points, angle)
        end
      end
    end
  end
end
