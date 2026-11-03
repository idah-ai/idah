# frozen_string_literal: true

require "fileutils"
require "yaml"
require "zlib"

module IdahImage
  module Export
    module Yolo
      # YOLO export of image datasets, in the Ultralytics layout (YOLOv5, v8,
      # 11), for detection, segmentation or oriented boxes (the `task` option).
      #
      # Every entry with a shape becomes an image with a label file, one line
      # per shape, coordinates as fractions of the image. A mask gives one line
      # per separate piece, from its outline (see Helpers::Mask#outlines).
      #
      # Each IDAH dataset is its own YOLO dataset, with its own classes, as
      # categories are set up per dataset:
      #
      #   <dataset>/data.yaml
      #   <dataset>/labels/<split>/<entry>.txt
      #   <dataset>/images/<split>/<entry>.<ext>   when include_medias is original or all
      #   export_report.json
      #
      # `<split>` is `train`, or `val` for the share of images set by the
      # `val_percent` option. The layout and the report are described in
      # README.md, next to this file.
      class Exporter < Helpers::BaseExporter
        # Shown in the export dialog: users pick by what they will train.
        TASK_CHOICES = [
          { value: "detect", label: "Detection (boxes)", info: "Upright boxes, for detection models." },
          { value: "segment", label: "Segmentation (outlines)", info: "Object outlines, for segmentation models." },
          { value: "obb", label: "Oriented boxes (rotated)", info: "Rotated boxes, for OBB models." }
        ].freeze
        # Mask pieces smaller than this, in pixels, are left out: specks that
        # would add a label line each, and with Ultralytics padding every
        # outline of an image to the longest, multiply its memory.
        MIN_MASK_PIECE = 20
        # Mask outlines longer than this, in points, are reported: a network of
        # thin lines with many holes, which YOLO polygons hold poorly.
        LONG_OUTLINE = 10_000
        TRAIN = "train"
        VAL = "val"

        def name = "YOLO (Image)"

        def description = "Ultralytics YOLO: boxes, outlines or rotated boxes."

        def options
          Verse::Schema.define do
            field(:task, String).default("detect").meta(
              label: "Task",
              description: "The kind of model you will train.",
              choices: TASK_CHOICES
            )
            field(:val_percent, Integer).default(0).meta(
              label: "Validation images (%)",
              description: "Share of images put in val. 0 keeps all in train.",
              min: 0,
              max: 50
            )
          end
        end

        def export(context)
          settings = options.validate(context.options.to_h.transform_keys(&:to_sym).slice(:task, :val_percent)).value
          @task = settings[:task]
          @val_percent = settings[:val_percent]
          super
        end

        private

        def export_dataset(dataset, filter)
          @root = File.join(@directory, dataset_stem(dataset))
          @categories = Helpers::CategoryIndex.new
          @categories.add_configuration(labeling_configuration(dataset))
          @image_stems = Set.new
          @splits = Set.new

          exported = dataset.entries(filter).count { |entry| export_entry(entry) }
          return @report.skip(:datasets_without_annotations) if exported.zero?

          write_data_yaml(dataset)
          @report.count(:datasets)
        end

        # @return [Boolean] whether the entry had shapes to export
        def export_entry(entry)
          image = Helpers::ImageEntry.new(entry, @report)
          return false unless image.load

          # YOLO holds shapes only: the image's tags have nowhere to go.
          image.entry_tags.each { |record| @report.skip("unsupported_shape_type:#{record.shape_type}") }

          lines = image.shapes.flat_map { |shape| labels(shape, image) }
          if lines.empty?
            @report.skip(:images_without_annotations)
            return false
          end

          split = split_for(entry)
          @splits << split
          stem = Helpers::Names.unique(File.basename(image.name, ".*"), @image_stems, "image")
          write_labels(File.join(@root, "labels", split, "#{stem}.txt"), lines)
          image.write_image(File.join(@root, "images", split, stem + image.extension)) if @with_images
          true
        end

        # Images go to val by their entry id, so the choice is the same in
        # every export.
        def split_for(entry)
          (Zlib.crc32(entry.record.id.to_s) % 100) < @val_percent ? VAL : TRAIN
        end

        # Ultralytics finds an image's labels by swapping `images` for `labels`
        # in its path and its extension for `.txt`.
        def write_labels(path, lines)
          FileUtils.mkdir_p(File.dirname(path))
          File.write(path, lines.map { |line| "#{line}\n" }.join)

          @report.count(:images)
          @report.count(:annotations, lines.size)
        end

        # The label lines of a shape: one, or one per piece of a mask. Each is
        # the class, then coordinates as fractions of the image.
        def labels(shape, image)
          width = image.width
          height = image.height
          class_id = @categories.id_for(shape.record.category) - 1
          outlines = shape.mask? ? mask_outlines(shape.mask) : [shape.points]
          warn_long_outline(image, shape, outlines) if shape.mask?

          outlines.map do |outline|
            values =
              case @task
              when "segment" then points(outline, width, height)
              when "obb" then points(oriented_box(shape, outline), width, height)
              else box(outline, width, height)
              end

            ([class_id.to_s] + values.map { |v| format("%.6f", v) }).join(" ")
          end
        end

        # A mask's pieces, without the specks. A box or a rotated box is the
        # same with or without holes, so only segment joins them.
        def mask_outlines(mask)
          outlines = mask.outlines(holes: @task == "segment")
          # A mask too thin to outline.
          @report.skip(:zero_area) if outlines.empty?

          outlines.reject do |outline|
            small = Helpers::Geometry.polygon_area(outline) < MIN_MASK_PIECE
            @report.skip(:small_mask_pieces) if small
            small
          end
        end

        # Exported all the same, but Ultralytics pads every outline of an image
        # to the longest when it loads it, which can take gigabytes.
        def warn_long_outline(image, shape, outlines)
          longest = outlines.map(&:size).max
          return unless longest && longest > LONG_OUTLINE

          @report.warn(
            "Entry `#{image.name}` (#{image.entry.record.id}): a `#{shape.record.category}` mask outline has " \
            "#{longest} points; Ultralytics pads every outline of the image to this length and may run out of " \
            "memory. Use the COCO export for this mask."
          )
        end

        # detect: `cx cy w h`, the box around the outline.
        def box(outline, width, height)
          x, y, w, h = Helpers::Geometry.envelope(outline).map(&:to_f)
          [(x + (w / 2)) / width, (y + (h / 2)) / height, w / width, h / height]
        end

        # segment and obb: `x1 y1 x2 y2 ...`.
        def points(outline, width, height)
          outline.flat_map { |x, y| [x / width.to_f, y / height.to_f] }
        end

        # obb: a box's own corners, rotation included; any other outline's
        # smallest rotated rectangle.
        def oriented_box(shape, outline)
          return outline if shape.record.shape_type == Helpers::ImageEntry::BOUNDING_BOX

          Helpers::Geometry.min_area_rect(outline)
        end

        # Written last: categories missing from the configuration are added as
        # annotations use them. With no image in val, val points at train.
        def write_data_yaml(dataset)
          if @val_percent.positive? && !@splits.include?(VAL)
            @report.warn(
              "Dataset `#{dataset.record.name}` (#{dataset.record.id}): no image fell in val; val points at train."
            )
          end

          train = @splits.include?(TRAIN) ? TRAIN : VAL
          val = @splits.include?(VAL) ? VAL : TRAIN
          names = @categories.categories.to_h { |category| [category[:id] - 1, category[:name]] }
          data = { "train" => "images/#{train}", "val" => "images/#{val}", "names" => names }

          File.write(File.join(@root, "data.yaml"), YAML.dump(data))
        end
      end
    end
  end
end
