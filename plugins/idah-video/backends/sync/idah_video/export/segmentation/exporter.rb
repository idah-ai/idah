# frozen_string_literal: true

require "fileutils"
require "json"

module IdahVideo
  module Export
    module Segmentation
      # Semantic segmentation export of video datasets: one class mask per
      # frame a box or polygon covers, a palette PNG where each pixel holds its
      # class index, 0 for background.
      #
      # Frames between keyframes are computed as the annotation tool draws
      # them (see Helpers::VideoEntry). Shapes are painted in creation order,
      # as the tool stacks them, so where shapes overlap the pixel takes the
      # class of the later one.
      #
      # Each IDAH dataset is its own folder, with its own classes, as
      # categories are set up per dataset:
      #
      #   <dataset>/classes.json
      #   <dataset>/masks/<video>/frame_NNNNNN.png
      #   <dataset>/images/<video>/frame_NNNNNN.jpg   when include_medias is original or all
      #   export_report.json
      #
      # The layout and the report are described in README.md, next to this
      # file.
      class Exporter < Helpers::BaseExporter
        # Class indexes are bytes: 0 is background, so 255 classes at most.
        MAX_CLASSES = 255
        FRAME_CHOICES = [
          { value: "all", label: "All frames", info: "Every frame a shape covers." },
          { value: "keyframes", label: "Keyframes only", info: "Frames with a stored keyframe." }
        ].freeze

        def name = "Mask Segmentation (Video)"

        def description = "Class masks as PNG images, one per frame."

        def options
          Verse::Schema.define do
            field(:frames, String).default("all").meta(
              label: "Frames",
              description: "Which frames to export.",
              choices: FRAME_CHOICES
            )
          end
        end

        def export(context)
          @frames = options.validate(context.options.to_h.transform_keys(&:to_sym).slice(:frames)).value[:frames]
          super
        end

        private

        def export_dataset(dataset, filter)
          @root = File.join(@directory, dataset_stem(dataset))
          @categories = Helpers::CategoryIndex.new
          @categories.add_configuration(labeling_configuration(dataset))
          @video_stems = Set.new

          exported = dataset.entries(filter).count { |entry| export_entry(entry) }
          return @report.skip(:datasets_without_annotated_frames) if exported.zero?

          write_classes
          @report.count(:datasets)
        end

        # @return [Boolean] whether the entry had frames to export
        def export_entry(entry)
          video = Helpers::VideoEntry.new(entry, @report)
          return false unless video.load

          # A mask holds shapes only: the entry's tags have nowhere to go.
          video.entry_tags.each { |record| @report.skip("unsupported_shape_type:#{record.shape_type}") }
          video.frame_tags.each_value do |records|
            records.each { |record| @report.skip("unsupported_shape_type:#{record.shape_type}") }
          end

          frames = exported_frames(video)
          if frames.empty?
            @report.skip(:videos_without_annotated_frames)
            return false
          end

          @report.count(:videos)
          stem = Helpers::Names.unique(File.basename(video.name, ".*"), @video_stems, "video")
          frames.each { |frame| write_mask(video, frame, stem) }
          video.write_images(frames, File.join(@root, "images", stem)) if @with_images
          true
        end

        # Frames a shape covers, or with `frames: keyframes`, those where a
        # shape has a stored keyframe. A kept frame paints every shape on it.
        def exported_frames(video)
          frames = video.shapes.keys.sort
          return frames if @frames == "all"

          frames.select { |frame| video.shapes[frame].any?(&:keyframe) }
        end

        def write_mask(video, frame, stem)
          canvas = Helpers::Canvas.new(video.width, video.height)
          shapes = in_drawing_order(video.shapes[frame])
          painted = shapes.count { |shape| paint(canvas, shape) }

          path = File.join(@root, "masks", stem, format("frame_%06d.png", frame))
          FileUtils.mkdir_p(File.dirname(path))
          Helpers::Png.write(path, canvas.width, canvas.height, canvas.pixels, palette)

          @report.count(:images)
          @report.count(:annotations, painted)
          @report.count(:interpolated_annotations, shapes.count { |shape| !shape.keyframe })
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

          canvas.fill_polygon(shape.points, index)
          true
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
