# frozen_string_literal: true

require "fileutils"
require "yaml"

module IdahVideo
  module Export
    module Yolo
      # YOLO detection export of video datasets, in the Ultralytics layout
      # (YOLOv5, v8, 11).
      #
      # Every frame a box or polygon covers becomes an image with a label file,
      # one line per visible shape: `class cx cy w h`, normalized to the frame.
      # Frames between keyframes are computed as the annotation tool draws them
      # (see Helpers::VideoEntry). A rotated box or a polygon is written as the
      # box around it.
      #
      # Each IDAH dataset is its own YOLO dataset, with its own classes, as
      # categories are set up per dataset:
      #
      #   <dataset>/data.yaml
      #   <dataset>/labels/train/<video>/frame_NNNNNN.txt
      #   <dataset>/images/train/<video>/frame_NNNNNN.jpg   when include_medias is original or all
      #   export_report.json
      #
      # Every frame is in `train`; `val` points at the same images.
      # The layout and the report are described in README.md, next to this file.
      class Exporter < Helpers::BaseExporter
        SPLIT = "train"

        def name = "YOLO Detect (Video)"

        def description = "YOLO detection labels (Ultralytics), one image per annotated frame."

        private

        def export_dataset(dataset, filter)
          @root = File.join(@directory, dataset_stem(dataset))
          @categories = Helpers::CategoryIndex.new
          @categories.add_configuration(labeling_configuration(dataset))
          @video_stems = Set.new

          exported = dataset.entries(filter).count { |entry| export_entry(entry) }
          return @report.skip(:datasets_without_annotated_frames) if exported.zero?

          write_data_yaml
          @report.count(:datasets)
        end

        # @return [Boolean] whether the entry had frames to export
        def export_entry(entry)
          video = Helpers::VideoEntry.new(entry, @report)
          return false unless video.load

          # YOLO holds boxes only: the entry's tags have nowhere to go.
          video.entry_tags.each { |record| @report.skip("unsupported_shape_type:#{record.shape_type}") }
          video.frame_tags.each_value do |records|
            records.each { |record| @report.skip("unsupported_shape_type:#{record.shape_type}") }
          end

          frames = video.shapes.keys.sort
          if frames.empty?
            @report.skip(:videos_without_annotated_frames)
            return false
          end

          @report.count(:videos)
          stem = Helpers::Names.unique(File.basename(video.name, ".*"), @video_stems, "video")
          frames.each { |frame| write_labels(video, frame, stem) }
          video.write_images(frames, File.join(@root, "images", SPLIT, stem)) if @with_images
          true
        end

        # Ultralytics finds an image's labels by swapping `images` for `labels`
        # in its path and its extension for `.txt`.
        def write_labels(video, frame, stem)
          path = File.join(@root, "labels", SPLIT, stem, format("frame_%06d.txt", frame))
          FileUtils.mkdir_p(File.dirname(path))

          lines = video.shapes[frame].map { |shape| label(shape, video.width, video.height) }
          File.write(path, lines.map { |line| "#{line}\n" }.join)

          @report.count(:images)
          @report.count(:annotations, lines.size)
        end

        # `class cx cy w h`: the box around the outline, its centre and size
        # as fractions of the frame.
        def label(shape, width, height)
          x, y, w, h = Helpers::Geometry.envelope(shape.points)
          class_id = @categories.id_for(shape.record.category) - 1

          format(
            "%<class_id>d %<cx>.6f %<cy>.6f %<w>.6f %<h>.6f",
            class_id:,
            cx: (x + (w / 2)) / width,
            cy: (y + (h / 2)) / height,
            w: w / width,
            h: h / height
          )
        end

        # Written last: categories missing from the configuration are added as
        # annotations use them.
        def write_data_yaml
          names = @categories.categories.to_h { |category| [category[:id] - 1, category[:name]] }
          data = { "train" => "images/#{SPLIT}", "val" => "images/#{SPLIT}", "names" => names }

          File.write(File.join(@root, "data.yaml"), YAML.dump(data))
        end
      end
    end
  end
end
