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
        LINE = "idah-image:line"
        SHAPES = [BOUNDING_BOX, POLYGON, CIRCLE, ELLIPSE, MASK].freeze

        # A shape in pixels. `points` is its outline, rotated as drawn and
        # clamped to the image, or for a line its open path; a mask has none
        # and gives its pixels in `mask`. `angle` is the rotation of a box or
        # an ellipse, in radians. `curve` is a circle's or an ellipse's exact
        # centre and radii, [cx, cy, rx, ry], before rotation: `points` traces
        # it with 64 points.
        Shape = Data.define(:record, :points, :angle, :mask, :curve) do
          def mask? = !mask.nil?

          def line? = record.shape_type == LINE
        end

        attr_reader :entry, :name, :width, :height, :shapes, :entry_tags

        # @param lines [Boolean] whether to read lines, for formats that can
        #   hold them; otherwise they are reported as unsupported
        def initialize(entry, report, lines: false)
          @entry = entry
          @report = report
          @lines = lines
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
          elsif SHAPES.include?(record.shape_type) || (@lines && record.shape_type == LINE)
            return @report.skip(:no_category) if record.category.nil? || record.category.to_s.empty?

            record.shape_type == LINE ? collect_line(record) : collect_shape(record)
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

            return @shapes << Shape.new(record:, points: nil, angle: 0.0, mask:, curve: nil)
          end

          points = outline(record.shape_type, args, angle)
          # Tools read a 2-point "polygon" as a box.
          return @report.skip(:too_few_points) if points.nil? || points.size < 3

          points = Geometry.clamp(points, width, height)
          # Drawn outside the image: clamping flattens it to a line or a point.
          return @report.skip(:zero_area) if Geometry.polygon_area(points).zero?

          @shapes << Shape.new(record:, points:, angle:, mask: nil, curve: curve(record.shape_type, args))
        end

        # A line's path in pixels, clamped to the image.
        def collect_line(record)
          points = Geometry.to_pixels(Array(Keys.symbolize(record.shape_args || {})[:points]), width, height)
          return @report.skip(:too_few_points) if points.size < 2

          @shapes << Shape.new(
            record:,
            points: Geometry.clamp(points, width, height),
            angle: 0.0,
            mask: nil,
            curve: nil
          )
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
          when CIRCLE, ELLIPSE
            centre_and_radii = curve(shape_type, args)
            rotated(Geometry.ellipse(*centre_and_radii), angle) if centre_and_radii
          end
        end

        # A circle's or an ellipse's centre and radii in pixels, [cx, cy, rx,
        # ry], or nil for other shapes or without a centre.
        def curve(shape_type, args)
          points = Array(args[:points])
          return unless [CIRCLE, ELLIPSE].include?(shape_type) && points.any?

          cx, cy = Geometry.to_pixels([points[0]], width, height).first
          if shape_type == CIRCLE
            # The radius is a fraction of the image's shorter side.
            radius = (args[:radius] || 0.1).to_f * [width, height].min
            [cx, cy, radius, radius]
          else
            # Points are the centre, then the radii as fractions of the width
            # and height.
            rx, ry = points[1] || [0.1, 0.05]
            [cx, cy, rx.to_f * width, ry.to_f * height]
          end
        end

        def rotated(points, angle)
          angle.zero? || points.empty? ? points : Geometry.rotate(points, angle)
        end
      end
    end
  end
end
