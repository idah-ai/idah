# frozen_string_literal: true

require "fileutils"
require "json"

module IdahImage
  module Export
    module Segmentation
      # Semantic segmentation export of image datasets: one class mask per
      # image, a palette PNG where each pixel holds its class index, 0 for
      # background.
      #
      # Masks are painted pixel for pixel and lines 1 pixel wide; boxes,
      # polygons, circles and ellipses are filled, or with `shapes: outline`,
      # drawn as their 1-pixel outline.
      # Shapes are painted in creation order, as the annotation tool draws
      # them, so where shapes overlap the pixel takes the class of the later
      # one.
      #
      # Each IDAH dataset is its own folder, with its own classes, as
      # categories are set up per dataset:
      #
      #   <dataset>/classes.json
      #   <dataset>/masks/<entry>.png
      #   <dataset>/images/<entry>.<ext>   when include_medias is original or all
      #   export_report.json
      #
      # The layout and the report are described in README.md, next to this
      # file.
      class Exporter < Helpers::BaseExporter
        SHAPE_TYPES = (Helpers::CategoryIndex::SHAPE_TYPES + %i[idah-image:line]).freeze
        # Class indexes are bytes: 0 is background, so 255 classes at most.
        MAX_CLASSES = 255
        # Lines, in pixels.
        LINE_WIDTH = 1
        # Shown in the export dialog.
        SHAPE_CHOICES = [
          { value: "filled", label: "Filled", info: "Each shape's whole area. What segmentation models train on." },
          { value: "outline", label: "Outlines", info: "Each shape's 1-pixel outline, for boundary detection." }
        ].freeze

        def name = "Mask Segmentation (Image)"

        def description = "Class masks as PNG images, one per image."

        def options
          Verse::Schema.define do
            field(:shapes, String).default("filled").meta(
              label: "Shapes",
              description: "How boxes, polygons, circles and ellipses are painted.",
              choices: SHAPE_CHOICES
            )
          end
        end

        def export(context)
          @shapes = options.validate(context.options.to_h.transform_keys(&:to_sym).slice(:shapes)).value[:shapes]
          super
        end

        private

        def export_dataset(dataset, filter)
          @dataset = dataset
          @root = File.join(@directory, dataset_stem(dataset))
          @categories = Helpers::CategoryIndex.new(shape_types: SHAPE_TYPES)
          @categories.add_configuration(labeling_configuration(dataset))
          @image_stems = Set.new

          exported = dataset.entries(filter).count { |entry| export_entry(entry) }
          return @report.skip(:datasets_without_annotations) if exported.zero?

          write_classes
          @report.count(:datasets)
        end

        # @return [Boolean] whether the entry had shapes to paint
        def export_entry(entry)
          image = Helpers::ImageEntry.new(entry, @report, lines: true)
          return false unless image.load

          # A mask holds shapes only: the image's tags have nowhere to go.
          image.entry_tags.each { |record| @report.skip("unsupported_shape_type:#{record.shape_type}") }

          canvas = Helpers::Canvas.new(image.width, image.height)
          painted = in_drawing_order(image.shapes).count { |shape| paint(canvas, shape) }
          if painted.zero?
            @report.skip(:images_without_annotations)
            return false
          end

          stem = Helpers::Names.unique(File.basename(image.name, ".*"), @image_stems, "image")
          write_mask(File.join(@root, "masks", "#{stem}.png"), canvas)
          @report.count(:images)
          @report.count(:annotations, painted)
          image.write_image(File.join(@root, "images", stem + image.extension)) if @with_images
          true
        end

        # Creation order, as the annotation tool stacks shapes; shapes without
        # a date keep their place first.
        def in_drawing_order(shapes)
          shapes.each_with_index.sort_by { |shape, index| [created_at(shape.record).to_s, index] }.map(&:first)
        end

        def created_at(record) = record.data.dig(:attributes, :created_at)

        # @return [Boolean] whether the shape was painted
        def paint(canvas, shape)
          index = @categories.id_for(shape.record.category)
          if index > MAX_CLASSES
            @report.skip(:too_many_classes)
            return false
          end

          if shape.mask?
            canvas.paint_mask(shape.mask, index)
          elsif shape.line?
            canvas.stroke_line(shape.points, LINE_WIDTH, index)
          elsif @shapes == "filled"
            canvas.fill_polygon(shape.points, index)
          elsif shape.curve
            # A circle or an ellipse: drawn as a pixel circle, not its 64 points.
            canvas.trace_ellipse(*shape.curve, shape.angle, index)
          else
            canvas.outline_polygon(shape.points, index)
          end
          true
        end

        def write_mask(path, canvas)
          FileUtils.mkdir_p(File.dirname(path))
          Helpers::Png.write(path, canvas.width, canvas.height, canvas.pixels, palette)
        end

        # Written last: categories missing from the configuration are added as
        # annotations use them.
        def write_classes
          classes = [{ index: 0, name: "background", color: [0, 0, 0] }] +
                    @categories.categories.first(MAX_CLASSES).map do |category|
                      { index: category[:id], name: category[:name], color: color(category) }
                    end
          File.write(File.join(@root, "classes.json"), JSON.pretty_generate(classes))
        end

        # Each class's colour, the same in classes.json and in the PNGs.
        def palette
          [[0, 0, 0]] + @categories.categories.first(MAX_CLASSES).map { |category| color(category) }
        end

        # The configured colour, or Pascal VOC's colour for the class index.
        def color(category)
          hex = @categories.color_for(category[:name]).to_s
          return hex.delete_prefix("#").scan(/../).map { |pair| pair.to_i(16) } if hex.match?(/\A#?\h{6}\z/)

          voc_color(category[:id])
        end

        def voc_color(index)
          rgb = [0, 0, 0]
          8.times do |bit|
            3.times { |channel| rgb[channel] |= ((index >> ((3 * bit) + channel)) & 1) << (7 - bit) }
          end
          rgb
        end
      end
    end
  end
end
