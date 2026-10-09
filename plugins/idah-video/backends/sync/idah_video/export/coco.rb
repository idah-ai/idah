# frozen_string_literal: true

require "tempfile"

module IdahVideo
  module Export
    # COCO export of video datasets, shaped like CVAT's COCO 1.0 so it can be
    # imported into CVAT.
    #
    # Every frame a track covers becomes a COCO image, with one annotation per
    # visible track. IDAH stores keyframes only, so the frames in between are
    # computed with the frontend's interpolation (Interpolator) and marked
    # `keyframe: false`. Tracks keep their identity in `attributes.track_id`,
    # images their frame number in `frame_id`, and the video's details are in
    # `info.video`.
    #
    # Each video is its own COCO subset, which CVAT imports as its own task:
    #
    #   annotations/instances_<video>.json
    #   images/<video>/frame_NNNNNN.jpg   when include_medias is original or all
    #   export_report.yml
    class Coco
      MODALITY = "idah-video"
      ENTRY_ROOT = "entry:root"
      FRAME_TAG = "idah-video:frame"
      BOUNDING_BOX = Interpolator::BOUNDING_BOX
      POLYGON = Interpolator::POLYGON

      # `include_medias` values that export frame images. The processed media
      # of "all" (streaming variants, thumbnails) have no place in COCO.
      IMAGE_MEDIA_OPTIONS = %w[original all].freeze

      # `occlusion` property values that set CVAT's `occluded` flag. Fully
      # occluded is not `outside`: the object is there, with the box drawn.
      OCCLUDED_VALUES = %w[partial full].freeze

      def name = "COCO 1.0 (Video)"

      def description = "COCO instances, one image per annotated frame, with track ids. Compatible with CVAT."

      def options = Verse::Schema.empty

      def export(context)
        directory = context.io.directory
        with_images = IMAGE_MEDIA_OPTIONS.include?(context.options[:include_medias].to_s)
        @images_dir = with_images ? File.join(directory, "images") : nil
        @report = Report.new
        @directory = directory
        @categories = CategoryIndex.new
        @stems = Set.new

        context.datasets.each do |dataset|
          check_modality!(dataset)
          @categories.add_configuration(dataset.record.data[:attributes][:labeling_configuration])

          dataset.entries(entries_filter(context)).each { |entry| export_entry(entry) }
        end

        @report.write(File.join(directory, "export_report.yml"))
      end

      private

      def check_modality!(dataset)
        modality = dataset.record.modality
        return if modality == MODALITY

        raise ArgumentError,
              "#{name} exports #{MODALITY} datasets only; dataset `#{dataset.record.name}` " \
              "(#{dataset.record.id}) is #{modality}."
      end

      # Only completed entries, unless the export says otherwise.
      def entries_filter(context)
        context.options.fetch(:completed_entries, true) ? { status: "completed" } : {}
      end

      def export_entry(entry)
        media = original_media(entry)
        meta = Keys.symbolize(media&.record&.data&.dig(:attributes, :meta) || {})
        name = video_name(entry, media)
        width = meta[:width].to_i
        height = meta[:height].to_i

        unless width.positive? && height.positive?
          return @report.warn(
            "Entry `#{name}` (#{entry.record.id}) skipped: video width and height are unknown."
          )
        end

        frames = Hash.new { |hash, frame| hash[frame] = { objects: [], tags: [] } }
        video_attributes = {}
        @track_ids = {}
        @track_frames = Hash.new { |hash, track_id| hash[track_id] = Set.new }
        @group_categories = Hash.new { |hash, group| hash[group] = [] }

        entry.annotations.each do |annotation|
          collect(annotation, frames, video_attributes, width, height)
        end

        report_split_groups(entry, name)
        add_track_end_frames(frames)

        # An empty subset would become an empty CVAT task.
        return @report.skip(:videos_without_annotated_frames) if frames.empty?

        stem = unique_stem(name)
        write_video(stem, frames, video_record(name, meta, width, height, video_attributes), width:, height:)
        write_images(entry, media, name, stem, frames.keys.sort) if @images_dir
      end

      def write_video(stem, frames, video, width:, height:)
        writer = CocoWriter.new(File.join(@directory, "annotations", "instances_#{stem}.json"), video:)
        @report.count(:videos)

        frames.keys.sort.each do |frame|
          write_frame(writer, frame, frames[frame], width:, height:)
        end

        writer.close(categories: @categories.categories)
      ensure
        writer&.discard
      end

      # Extracts the exported frames from the original video, into the folder
      # their `file_name` points to. A video that cannot be read keeps its
      # labels; the report says why its images are missing.
      def write_images(entry, media, name, stem, frames)
        Tempfile.create(["idah-video", File.extname(name)]) do |file|
          file.binmode
          file.write(media.download)
          file.flush

          written = FrameExtractor.extract(file.path, frames, File.join(@images_dir, stem))
          @report.count(:image_files, written.size)

          missing = frames.size - written.size
          next unless missing.positive?

          @report.warn(
            "Entry `#{name}` (#{entry.record.id}): #{missing} frames past the end of the video have no image."
          )
        end
      rescue StandardError => e
        Verse.logger&.warn { "Video COCO export: no images for entry #{entry.record.id}: #{e.message}" }
        @report.warn("Entry `#{name}` (#{entry.record.id}): no images, the video could not be read (#{e.class}).")
      end

      def collect(annotation, frames, video_attributes, width, height)
        record = annotation.record
        attributes = record.data[:attributes]
        return @report.skip(:deleted) if attributes[:deleted_at]

        case record.shape_type
        when ENTRY_ROOT
          video_attributes.merge!(tag(record))
        when FRAME_TAG
          frames[tag_frame(record)][:tags] << record.category
        when BOUNDING_BOX, POLYGON
          return @report.skip(:no_category) if record.category.nil? || record.category.to_s.empty?

          collect_track(record, attributes, frames, width, height)
        else
          @report.skip("unsupported_shape_type:#{record.shape_type}")
        end
      end

      # One annotation per frame the track draws on: its keyframes and every
      # frame between two of them.
      def collect_track(record, attributes, frames, width, height)
        shape_args = Keys.symbolize(record.shape_args || {})
        keyframes = Array(shape_args[:frames]).map { |f| f[:frame] }
        return @report.skip(:no_keyframes) if keyframes.empty?

        first = [keyframes.min, shape_args[:start]].compact.max
        last = [keyframes.max, shape_args[:end]].compact.min
        track_id = track_id_for(record, attributes)
        category_id = @categories.id_for(record.category)
        properties = Keys.symbolize(record.properties || {})
        occluded = occluded?(properties[:occlusion])

        (first..last).each do |frame|
          geometry = Interpolator.at(record.shape_type, shape_args, frame)
          next unless geometry

          # CVAT rejects a track with two shapes on one frame; the first wins.
          next @report.skip(:duplicate_track_frames) unless @track_frames[track_id].add?(frame)

          frames[frame][:objects] << object(record.shape_type, geometry, width, height).merge(
            category_id:,
            iscrowd: 0,
            attributes: properties.merge(occluded:, track_id:, keyframe: geometry.keyframe)
                        .merge(geometry_attributes(record.shape_type, geometry))
          )
        end
      end

      def occluded?(occlusion)
        Array(occlusion).any? { |value| OCCLUDED_VALUES.include?(value.to_s.strip.downcase) }
      end

      # CVAT ends a track where it skips a frame. Its tasks number only the
      # exported images, so the frame after a track's end is exported too,
      # empty, whenever a later frame is: otherwise CVAT would join the track
      # onto the next exported frame.
      def add_track_end_frames(frames)
        last_frame = frames.keys.max

        @track_frames.each_value do |track|
          track.each do |frame|
            following = frame + 1
            next if track.include?(following) || frames.key?(following) || following > last_frame

            frames[following] # an empty frame
            @report.count(:track_end_frames)
          end
        end
      end

      def report_split_groups(entry, name)
        @group_categories.each do |group, categories|
          next if categories.size < 2

          @report.warn(
            "Entry `#{name}` (#{entry.record.id}): group #{group} has #{categories.size} categories " \
            "(#{categories.join(", ")}), exported as #{categories.size} tracks."
          )
        end
      end

      # Boxes follow CVAT: the box as drawn before rotation, the rotation in
      # attributes, and no segmentation. Polygons are written as outlines.
      def object(shape_type, geometry, width, height)
        points = Geometry.to_pixels(geometry.points, width, height)

        if shape_type == BOUNDING_BOX
          points = Geometry.clamp(points, width, height) if geometry.angle.zero?
          bbox = Geometry.envelope(points)

          { segmentation: [], area: Geometry.round(bbox[2] * bbox[3]), bbox: bbox.map { |v| Geometry.round(v) } }
        else
          points = Geometry.clamp(points, width, height)

          {
            segmentation: [Geometry.flatten(points)],
            area: Geometry.round(Geometry.polygon_area(points)),
            bbox: Geometry.envelope(points).map { |v| Geometry.round(v) }
          }
        end
      end

      def geometry_attributes(shape_type, geometry)
        shape_type == BOUNDING_BOX ? { rotation: Geometry.degrees(geometry.angle) } : {}
      end

      # `file_name` is relative to the subset's image folder, images/<video>/,
      # and matches CVAT's own frame names.
      def write_frame(writer, frame, content, width:, height:)
        image = {
          width:,
          height:,
          file_name: format("frame_%06d.jpg", frame),
          license: 0,
          flickr_url: "",
          coco_url: "",
          date_captured: 0,
          frame_id: frame
        }
        image[:attributes] = { frame_tags: content[:tags] } unless content[:tags].empty?

        image_id = writer.add_image(image)
        @report.count(:images)

        content[:objects].each do |object|
          writer.add_annotation({ image_id: }.merge(object))
          @report.count(:annotations)
          @report.count(:interpolated_annotations) unless object[:attributes][:keyframe]
        end
      end

      def video_record(name, meta, width, height, attributes)
        fps = meta[:fps]&.to_f
        duration = meta[:duration]&.to_f

        video = {
          name:,
          width:,
          height:,
          fps:,
          # Same frame count as the frontend: floor(duration * fps).
          length: fps && duration ? (duration * fps).floor : nil
        }.compact
        video[:attributes] = attributes unless attributes.empty?
        video
      end

      def tag(record)
        { category: record.category }.merge(Keys.symbolize(record.properties || {}))
      end

      def tag_frame(record)
        shape_args = Keys.symbolize(record.shape_args || {})
        shape_args[:start] || Array(shape_args[:frames]).first&.dig(:frame)
      end

      # Annotations of the same group are one object across the video: they
      # share a track id. A group's first row has no group_id and later rows
      # carry its id. A CVAT track has one label, so a group whose rows have
      # different categories is one track per category. Track ids count from 0
      # in each video, as in a CVAT task.
      def track_id_for(record, attributes)
        group = Keys.symbolize(attributes[:metadata] || {})[:group_id] || record.id
        @group_categories[group] |= [record.category]
        @track_ids[[group, record.category]] ||= @track_ids.size
      end

      # The original upload holds the video's width, height, fps and duration.
      def original_media(entry)
        entry.medias({ key: "" }).first
      end

      # Entries can have no name; the uploaded file's name stands in for it.
      def video_name(entry, media)
        [entry.record.name, media&.record&.data&.dig(:attributes, :filename), entry.record.id]
          .map(&:to_s).find { |name| !name.empty? }
      end

      # Names the video's subset: its annotation file, image folder and CVAT
      # task. Duplicated entries share a name, so later ones get a numbered
      # suffix.
      def unique_stem(name)
        base = File.basename(name, ".*").gsub(/[^\w.-]+/, "_")
        base = "video" if base.empty?

        stem = base
        suffix = 1
        stem = "#{base}_#{suffix += 1}" until @stems.add?(stem)
        stem
      end
    end
  end
end
