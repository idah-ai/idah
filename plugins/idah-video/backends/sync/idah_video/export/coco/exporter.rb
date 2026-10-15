# frozen_string_literal: true

module IdahVideo
  module Export
    module Coco
      # COCO instances export of video datasets.
      #
      # Every frame a box or polygon covers becomes a COCO image, with one
      # annotation per visible shape (see Helpers::VideoEntry for how frames
      # between keyframes are computed).
      #
      # The standard COCO fields are complete on their own. The video data rides
      # along in the fields COCO video datasets (YouTube-VIS, TAO) add, which
      # COCO tools ignore: a top-level `videos` list, `video_id` and `frame_id`
      # on images, `track_id` on annotations, and `attributes` for the rest.
      #
      # Each dataset is its own COCO file, with its own categories and image
      # folder, as COCO's train and val splits are:
      #
      #   annotations/instances_<dataset>.json
      #   images/<dataset>/<video>/frame_NNNNNN.jpg   when include_medias is original or all
      #   export_report.json
      #
      # The fields and the report are described in README.md, next to this file.
      class Exporter < Helpers::BaseExporter
        BOUNDING_BOX = Helpers::VideoEntry::BOUNDING_BOX

        def name = "COCO (Video)"

        def description = "COCO instances, with videos and tracks."

        FRAME_CHOICES = [
          { value: "all", label: "All frames", info: "Every frame a shape covers." },
          { value: "keyframes", label: "Keyframes only", info: "Frames with a stored keyframe." }
        ].freeze

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

        # Categories are set up per dataset in IDAH, so each file lists its own,
        # and ids, track ids included, count from 1 in each file.
        def export_dataset(dataset, filter)
          @dataset_stem = dataset_stem(dataset)
          @categories = Helpers::CategoryIndex.new
          @categories.add_configuration(labeling_configuration(dataset))
          @writer = Writer.new(File.join(@directory, "annotations", "instances_#{@dataset_stem}.json"))
          @images_dir = File.join(@directory, "images", @dataset_stem) if @with_images
          @video_stems = Set.new
          @track_ids = {}

          dataset.entries(filter).each { |entry| export_entry(dataset, entry) }

          if @writer.empty?
            @writer.discard
            return @report.skip(:datasets_without_annotated_frames)
          end

          @writer.close(categories: @categories.categories)
          @report.count(:datasets)
        end

        def cleanup = @writer&.discard

        def export_entry(dataset, entry)
          video = Helpers::VideoEntry.new(entry, @report)
          return unless video.load

          @groups = Hash.new { |hash, group| hash[group] = {} }
          # Tracks are numbered in annotation order.
          video.shape_records.each { |record| track_id_for(record) }
          frames = exported_frames(video)

          if frames.empty?
            report_split_groups(video)
            return @report.skip(:videos_without_annotated_frames)
          end

          video_id = @writer.add_video(video_record(dataset, video))
          @report.count(:videos)

          stem = Helpers::Names.unique(File.basename(video.name, ".*"), @video_stems, "video")
          frames.each { |frame| write_frame(video, frame, stem:, video_id:) }
          report_split_groups(video)
          video.write_images(frames, File.join(@images_dir, stem)) if @images_dir
        end

        # All frames, or with `frames: keyframes`, the frames where annotators
        # stored a keyframe or a tag. A kept frame still lists every visible
        # shape, computed ones included: COCO takes an image's annotations as
        # complete, so leaving one out would make it background.
        def exported_frames(video)
          return video.frames if @frames == "all"

          video.frames.select do |frame|
            video.shapes[frame].any?(&:keyframe) || video.frame_tags[frame].any?
          end
        end

        # `file_name` is relative to the dataset's images folder, images/<dataset>/.
        def write_frame(video, frame, stem:, video_id:)
          image = {
            file_name: format("%<stem>s/frame_%<frame>06d.jpg", stem:, frame:),
            width: video.width,
            height: video.height,
            video_id:,
            frame_id: frame
          }
          tags = video.frame_tags[frame]
          image[:attributes] = { frame_tags: tags.map { |record| tag(record) } } unless tags.empty?

          image_id = @writer.add_image(image)
          @report.count(:images)

          video.shapes[frame].each do |shape|
            @writer.add_annotation({ image_id: }.merge(annotation(shape)))
            @report.count(:annotations)
            @report.count(:interpolated_annotations) unless shape.keyframe
          end
        end

        # The outline as a COCO polygon, with the box around it.
        def annotation(shape)
          record = shape.record

          {
            segmentation: [Helpers::Geometry.flatten(shape.points)],
            area: Helpers::Geometry.round(Helpers::Geometry.polygon_area(shape.points)),
            bbox: Helpers::Geometry.envelope(shape.points).map { |v| Helpers::Geometry.round(v) },
            category_id: @categories.id_for(record.category),
            iscrowd: 0,
            track_id: track_id_for(record),
            attributes: annotation_attributes(shape)
          }
        end

        # The IDAH properties, plus whether the shape is a stored keyframe or
        # computed, a box's rotation in degrees (clockwise), and the IDAH
        # annotation id.
        def annotation_attributes(shape)
          record = shape.record
          properties = Helpers::Keys.symbolize(record.properties || {})
          attributes = properties.merge(idah_id: record.id, keyframe: shape.keyframe)
          attributes[:rotation] = Helpers::Geometry.degrees(shape.angle) if record.shape_type == BOUNDING_BOX
          attributes
        end

        def video_record(dataset, video)
          record = {
            name: video.name,
            width: video.width,
            height: video.height,
            fps: video.meta[:fps]&.to_f,
            length: video.length,
            idah_entry_id: video.entry.record.id,
            idah_dataset_id: dataset.record.id
          }.compact
          attributes = video.entry_tags.reduce({}) { |merged, tag_record| merged.merge(tag(tag_record)) }
          record[:attributes] = attributes unless attributes.empty?
          record
        end

        # An entry-level or frame tag: its category and properties.
        def tag(record)
          { category: record.category }.merge(Helpers::Keys.symbolize(record.properties || {}))
        end

        # Annotations of the same group are one object across the video: they
        # share a track id. A group's first row has no group_id and later rows
        # carry its id. A track has one category, so a group whose rows have
        # different categories is one track per category. Track ids count from 1
        # and are unique in the file.
        def track_id_for(record)
          group = Helpers::Keys.symbolize(record.data[:attributes][:metadata] || {})[:group_id] || record.id
          @groups[group][record.category] ||= (@track_ids[[group, record.category]] ||= @track_ids.size + 1)
        end

        # Lists the groups split into several tracks in the report, so they can
        # be checked against IDAH.
        def report_split_groups(video)
          @groups.each do |group, tracks|
            next if tracks.size < 2

            @report.split_group(
              dataset: @dataset_stem,
              video: video.name,
              idah_entry_id: video.entry.record.id,
              group:,
              tracks: tracks.map { |category, track_id| { category:, track_id: } }
            )
          end
        end
      end
    end
  end
end
