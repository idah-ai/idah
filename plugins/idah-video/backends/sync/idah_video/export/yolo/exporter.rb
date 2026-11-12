# frozen_string_literal: true

require "fileutils"
require "yaml"
require "zlib"

module IdahVideo
  module Export
    module Yolo
      # YOLO export of video datasets, in the Ultralytics layout (YOLOv5, v8,
      # 11), for detection, segmentation or oriented boxes (the `task` option).
      #
      # Every frame a box or polygon covers becomes an image with a label file,
      # one line per visible shape, coordinates as fractions of the frame.
      # Frames between keyframes are computed as the annotation tool draws them
      # (see Helpers::VideoEntry).
      #
      # Each IDAH dataset is its own YOLO dataset, with its own classes, as
      # categories are set up per dataset:
      #
      #   <dataset>/data.yaml
      #   <dataset>/labels/<split>/<video>/frame_NNNNNN.txt
      #   <dataset>/images/<split>/<video>/frame_NNNNNN.jpg   when include_medias is original or all
      #   export_report.json
      #
      # `<split>` is `train`, or `val` for the share of videos set by the
      # `val_percent` option. The layout and the report are described in
      # README.md, next to this file.
      class Exporter < Helpers::BaseExporter
        # Shown in the export dialog: users pick by what they will train.
        TASK_CHOICES = [
          { value: "detect", label: "Detection (boxes)", info: "Upright boxes, for detection models." },
          { value: "segment", label: "Segmentation (outlines)", info: "Object outlines, for segmentation models." },
          { value: "obb", label: "Oriented boxes (rotated)", info: "Rotated boxes, for OBB models." }
        ].freeze
        TRAIN = "train"
        VAL = "val"

        def name = "YOLO (Video)"

        def description = "Ultralytics YOLO: boxes, outlines or rotated boxes."

        def options
          Verse::Schema.define do
            field(:task, String).default("detect").meta(
              label: "Task",
              description: "The kind of model you will train.",
              choices: TASK_CHOICES
            )
            field(:val_percent, Integer).default(0).meta(
              label: "Validation videos (%)",
              description: "Share of videos put in val. 0 keeps all in train.",
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
          @video_stems = Set.new
          @splits = Set.new

          exported = dataset.entries(filter).count { |entry| export_entry(entry) }
          return @report.skip(:datasets_without_annotated_frames) if exported.zero?

          write_data_yaml(dataset)
          @report.count(:datasets)
        end

        # @return [Boolean] whether the entry had frames to export
        def export_entry(entry)
          video = Helpers::VideoEntry.new(entry, @report)
          return false unless video.load

          # YOLO holds shapes only: the entry's tags have nowhere to go.
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
          split = split_for(entry)
          @splits << split
          stem = Helpers::Names.unique(File.basename(video.name, ".*"), @video_stems, "video")
          frames.each { |frame| write_labels(video, frame, File.join(split, stem)) }
          video.write_images(frames, File.join(@root, "images", split, stem)) if @with_images
          true
        end

        # Whole videos go to val, chosen from the entry id: neighbouring frames
        # look alike, so a video split across train and val would leak. The
        # choice is the same in every export.
        def split_for(entry)
          (Zlib.crc32(entry.record.id.to_s) % 100) < @val_percent ? VAL : TRAIN
        end

        # Ultralytics finds an image's labels by swapping `images` for `labels`
        # in its path and its extension for `.txt`.
        def write_labels(video, frame, folder)
          path = File.join(@root, "labels", folder, format("frame_%06d.txt", frame))
          FileUtils.mkdir_p(File.dirname(path))

          lines = video.shapes[frame].map { |shape| label(shape, video.width, video.height) }
          File.write(path, lines.map { |line| "#{line}\n" }.join)

          @report.count(:images)
          @report.count(:annotations, lines.size)
          @report.count(:interpolated_annotations, video.shapes[frame].count { |shape| !shape.keyframe })
        end

        # One label line: the class, then coordinates as fractions of the frame.
        def label(shape, width, height)
          class_id = @categories.id_for(shape.record.category) - 1
          values =
            case @task
            when "segment" then points(shape.points, width, height)
            when "obb" then points(oriented_box(shape), width, height)
            else box(shape.points, width, height)
            end

          ([class_id.to_s] + values.map { |v| format("%.6f", v) }).join(" ")
        end

        # detect: `cx cy w h`, the box around the outline.
        def box(outline, width, height)
          x, y, w, h = Helpers::Geometry.envelope(outline)
          [(x + (w / 2)) / width, (y + (h / 2)) / height, w / width, h / height]
        end

        # segment and obb: `x1 y1 x2 y2 ...`.
        def points(outline, width, height)
          outline.flat_map { |x, y| [x / width, y / height] }
        end

        # obb: a box's own corners, rotation included; a polygon's smallest
        # rotated rectangle.
        def oriented_box(shape)
          return shape.points if shape.record.shape_type == Helpers::VideoEntry::BOUNDING_BOX

          Helpers::Geometry.min_area_rect(shape.points)
        end

        # Written last: categories missing from the configuration are added as
        # annotations use them. With no video in val, val points at train.
        def write_data_yaml(dataset)
          if @val_percent.positive? && !@splits.include?(VAL)
            @report.warn(
              "Dataset `#{dataset.record.name}` (#{dataset.record.id}): no video fell in val; " \
                                       "val points at train."
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
