# frozen_string_literal: true

module IdahImage
  module Export
    module Coco
      # COCO instances export of image datasets.
      #
      # Every entry with a shape or an image-level tag becomes a COCO image,
      # with one annotation per shape: boxes, polygons, circles and ellipses as
      # polygons, masks as COCO RLE (see Helpers::ImageEntry and Helpers::Mask).
      # IDAH data with no COCO field goes in `attributes`, which COCO tools
      # ignore.
      #
      # Each dataset is its own COCO file, with its own categories and image
      # folder, as COCO's train and val splits are:
      #
      #   annotations/instances_<dataset>.json
      #   images/<dataset>/<entry>.<ext>   when include_medias is original or all
      #   export_report.json
      #
      # The fields and the report are described in README.md, next to this file.
      class Exporter < Helpers::BaseExporter
        ROTATED = [Helpers::ImageEntry::BOUNDING_BOX, Helpers::ImageEntry::ELLIPSE].freeze

        def name = "COCO (Image)"

        def description = "COCO instances: boxes, outlines and masks."

        private

        # Categories are set up per dataset in IDAH, so each file lists its own,
        # and ids count from 1 in each file.
        def export_dataset(dataset, filter)
          @dataset = dataset
          @categories = Helpers::CategoryIndex.new
          @categories.add_configuration(labeling_configuration(dataset))
          stem = dataset_stem(dataset)
          @writer = Writer.new(File.join(@directory, "annotations", "instances_#{stem}.json"))
          @images_dir = File.join(@directory, "images", stem) if @with_images
          @image_stems = Set.new

          dataset.entries(filter).each { |entry| export_entry(entry) }

          if @writer.empty?
            @writer.discard
            return @report.skip(:datasets_without_annotations)
          end

          @writer.close(categories: @categories.categories)
          @report.count(:datasets)
        end

        def cleanup = @writer&.discard

        def export_entry(entry)
          image = Helpers::ImageEntry.new(entry, @report)
          return unless image.load
          return @report.skip(:images_without_annotations) if image.empty?

          file_name = Helpers::Names.unique(File.basename(image.name, ".*"), @image_stems, "image") + image.extension
          image_id = @writer.add_image(image_record(image, file_name))
          @report.count(:images)

          image.shapes.each do |shape|
            @writer.add_annotation({ image_id: }.merge(annotation(shape)))
            @report.count(:annotations)
          end

          image.write_image(File.join(@images_dir, file_name)) if @images_dir
        end

        # `file_name` is relative to the dataset's images folder, images/<dataset>/.
        def image_record(image, file_name)
          record = {
            file_name:,
            width: image.width,
            height: image.height,
            idah_entry_id: image.entry.record.id,
            idah_dataset_id: @dataset.record.id
          }
          tags = image.entry_tags.reduce({}) { |merged, tag| merged.merge(tag(tag)) }
          record[:attributes] = tags unless tags.empty?
          record
        end

        # A mask as COCO RLE, every other shape as its outline polygon, each
        # with the box around it.
        def annotation(shape)
          geometry =
            if shape.mask?
              { segmentation: shape.mask.coco_rle, area: shape.mask.area, bbox: shape.mask.bbox }
            else
              {
                segmentation: [Helpers::Geometry.flatten(shape.points)],
                area: Helpers::Geometry.round(Helpers::Geometry.polygon_area(shape.points)),
                bbox: Helpers::Geometry.envelope(shape.points).map { |v| Helpers::Geometry.round(v) }
              }
            end

          geometry.merge(
            category_id: @categories.id_for(shape.record.category),
            iscrowd: 0,
            attributes: annotation_attributes(shape)
          )
        end

        # The IDAH properties and annotation id, plus the rotation of a box or
        # an ellipse in degrees (clockwise).
        def annotation_attributes(shape)
          record = shape.record
          attributes = Helpers::Keys.symbolize(record.properties || {}).merge(idah_id: record.id)
          attributes[:rotation] = Helpers::Geometry.degrees(shape.angle) if ROTATED.include?(record.shape_type)
          attributes
        end

        # An image-level tag: its category and properties.
        def tag(record)
          { category: record.category }.merge(Helpers::Keys.symbolize(record.properties || {}))
        end
      end
    end
  end
end
