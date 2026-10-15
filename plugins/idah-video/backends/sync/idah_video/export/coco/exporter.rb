# frozen_string_literal: true

require "tempfile"

module IdahVideo
  module Export
    module Coco
      # COCO instances export of video datasets.
      #
      # Every frame a box or polygon covers becomes a COCO image, with one
      # annotation per visible shape. IDAH stores keyframes only, so the frames
      # in between are computed with the frontend's interpolation (Interpolator),
      # which keeps every exported image fully labelled.
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
      class Exporter
        MODALITY = "idah-video"
        ENTRY_ROOT = "entry:root"
        FRAME_TAG = "idah-video:frame"
        BOUNDING_BOX = Helpers::Interpolator::BOUNDING_BOX
        POLYGON = Helpers::Interpolator::POLYGON

        # `include_medias` values that export frame images. The processed media
        # of "all" (streaming variants, thumbnails) have no place in COCO.
        IMAGE_MEDIA_OPTIONS = %w[original all].freeze

        def name = "COCO (Video)"

        def description = "COCO instances JSON, one image per annotated frame, with videos and tracks."

        def options = Verse::Schema.empty

        def export(context)
          @directory = context.io.directory
          @with_images = IMAGE_MEDIA_OPTIONS.include?(context.options[:include_medias].to_s)
          @report = Helpers::Report.new
          @dataset_stems = Set.new

          context.datasets.each do |dataset|
            check_modality!(dataset)
            export_dataset(dataset, entries_filter(context))
          end

          @report.write(File.join(@directory, "export_report.json"))
        ensure
          @writer&.discard
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

        # Categories are set up per dataset in IDAH, so each file lists its own,
        # and ids, track ids included, count from 1 in each file.
        def export_dataset(dataset, filter)
          @dataset_stem = unique_stem(dataset.record.name.to_s, @dataset_stems, "dataset")
          @categories = CategoryIndex.new
          @categories.add_configuration(dataset.record.data[:attributes][:labeling_configuration])
          @writer = Writer.new(File.join(@directory, "annotations", "instances_#{@dataset_stem}.json"))
          @images_dir = File.join(@directory, "images", @dataset_stem) if @with_images
          @stems = Set.new
          @track_ids = {}

          dataset.entries(filter).each { |entry| export_entry(dataset, entry) }

          if @writer.empty?
            @writer.discard
            return @report.skip(:datasets_without_annotated_frames)
          end

          @writer.close(categories: @categories.categories)
          @report.count(:datasets)
        end

        def export_entry(dataset, entry)
          media = original_media(entry)
          meta = Helpers::Keys.symbolize(media&.record&.data&.dig(:attributes, :meta) || {})
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
          @groups = Hash.new { |hash, group| hash[group] = {} }
          entry.annotations.each { |annotation| collect(annotation, frames, video_attributes, width, height) }
          report_split_groups(entry, name)
          return @report.skip(:videos_without_annotated_frames) if frames.empty?

          video_id = @writer.add_video(video_record(dataset, entry, name, meta, width, height, video_attributes))
          @report.count(:videos)

          stem = unique_stem(File.basename(name, ".*"), @stems, "video")
          frames.keys.sort.each { |frame| write_frame(frames[frame], stem:, frame:, video_id:, width:, height:) }
          write_images(entry, media, name, stem, frames.keys.sort) if @images_dir
        end

        def collect(annotation, frames, video_attributes, width, height)
          record = annotation.record
          return @report.skip(:deleted) if record.data[:attributes][:deleted_at]

          case record.shape_type
          when ENTRY_ROOT
            video_attributes.merge!(tag(record))
          when FRAME_TAG
            frames[tag_frame(record)][:tags] << tag(record)
          when BOUNDING_BOX, POLYGON
            return @report.skip(:no_category) if record.category.nil? || record.category.to_s.empty?

            collect_shape(record, frames, width, height)
          else
            @report.skip("unsupported_shape_type:#{record.shape_type}")
          end
        end

        # One annotation per frame the shape is drawn on: its keyframes and every
        # frame between two of them.
        def collect_shape(record, frames, width, height)
          shape_args = Helpers::Keys.symbolize(record.shape_args || {})
          keyframes = Array(shape_args[:frames]).map { |f| f[:frame] }
          return @report.skip(:no_keyframes) if keyframes.empty?

          first = [keyframes.min, shape_args[:start]].compact.max
          last = [keyframes.max, shape_args[:end]].compact.min
          category_id = @categories.id_for(record.category)
          track_id = track_id_for(record)
          properties = Helpers::Keys.symbolize(record.properties || {})

          (first..last).each do |frame|
            geometry = Helpers::Interpolator.at(record.shape_type, shape_args, frame)
            next unless geometry
            # COCO tools read a 2-point "polygon" as a box.
            next @report.skip(:too_few_points) if geometry.points.size < 3

            object = object(geometry, width, height)
            # Drawn outside the video: clamping flattens it to a line or a point.
            next @report.skip(:zero_area) if object[:area].zero?

            @report.count(:interpolated_annotations) unless geometry.keyframe
            frames[frame][:objects] << object.merge(
              category_id:,
              iscrowd: 0,
              track_id:,
              attributes: annotation_attributes(record, geometry, properties)
            )
          end
        end

        # The outline in pixels, clamped to the frame, as a COCO polygon, with
        # the box around it. A rotated box is turned around its centre first,
        # as the frontend draws it.
        def object(geometry, width, height)
          points = Helpers::Geometry.to_pixels(geometry.points, width, height)
          points = Helpers::Geometry.rotate(points, geometry.angle) unless geometry.angle.zero?
          points = Helpers::Geometry.clamp(points, width, height)

          {
            segmentation: [Helpers::Geometry.flatten(points)],
            area: Helpers::Geometry.round(Helpers::Geometry.polygon_area(points)),
            bbox: Helpers::Geometry.envelope(points).map { |v| Helpers::Geometry.round(v) }
          }
        end

        # The IDAH properties, plus whether the shape is a stored keyframe or
        # computed, a box's rotation in degrees (clockwise), and the IDAH
        # annotation id.
        def annotation_attributes(record, geometry, properties)
          attributes = properties.merge(idah_id: record.id, keyframe: geometry.keyframe)
          attributes[:rotation] = Helpers::Geometry.degrees(geometry.angle) if record.shape_type == BOUNDING_BOX
          attributes
        end

        # `file_name` is relative to the dataset's images folder, images/<dataset>/.
        def write_frame(content, stem:, frame:, video_id:, width:, height:)
          image = {
            file_name: format("%<stem>s/frame_%<frame>06d.jpg", stem:, frame:),
            width:,
            height:,
            video_id:,
            frame_id: frame
          }
          image[:attributes] = { frame_tags: content[:tags] } unless content[:tags].empty?

          image_id = @writer.add_image(image)
          @report.count(:images)

          content[:objects].each do |object|
            @writer.add_annotation({ image_id: }.merge(object))
            @report.count(:annotations)
          end
        end

        def video_record(dataset, entry, name, meta, width, height, attributes)
          fps = meta[:fps]&.to_f
          duration = meta[:duration]&.to_f

          video = {
            name:,
            width:,
            height:,
            fps:,
            # Same frame count as the frontend: floor(duration * fps).
            length: fps && duration ? (duration * fps).floor : nil,
            idah_entry_id: entry.record.id,
            idah_dataset_id: dataset.record.id
          }.compact
          video[:attributes] = attributes unless attributes.empty?
          video
        end

        # An entry-level or frame tag: its category and properties.
        def tag(record)
          { category: record.category }.merge(Helpers::Keys.symbolize(record.properties || {}))
        end

        def tag_frame(record)
          shape_args = Helpers::Keys.symbolize(record.shape_args || {})
          shape_args[:start] || Array(shape_args[:frames]).first&.dig(:frame)
        end

        # Annotations of the same group are one object across the video: they
        # share a track id. A group's first row has no group_id and later rows
        # carry its id. A track has one category, so a group whose rows have
        # different categories is one track per category. Track ids count from 1
        # and are unique in the export.
        def track_id_for(record)
          group = Helpers::Keys.symbolize(record.data[:attributes][:metadata] || {})[:group_id] || record.id
          @groups[group][record.category] ||= (@track_ids[[group, record.category]] ||= @track_ids.size + 1)
        end

        # Lists the groups split into several tracks in the report, so they can
        # be checked against IDAH.
        def report_split_groups(entry, name)
          @groups.each do |group, tracks|
            next if tracks.size < 2

            @report.split_group(
              dataset: @dataset_stem,
              video: name,
              idah_entry_id: entry.record.id,
              group:,
              tracks: tracks.map { |category, track_id| { category:, track_id: } }
            )
          end
        end

        # Extracts the exported frames from the original video, into the folder
        # their `file_name` points to. A video that cannot be read keeps its
        # labels; the report says why its images are missing.
        def write_images(entry, media, name, stem, frames)
          Tempfile.create(["idah-video", File.extname(name)]) do |file|
            file.binmode
            file.write(media.download)
            file.flush

            written = Helpers::FrameExtractor.extract(file.path, frames, File.join(@images_dir, stem))
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

        # The original upload holds the video's width, height, fps and duration.
        def original_media(entry)
          entry.medias({ key: "" }).first
        end

        # Entries can have no name; the uploaded file's name stands in for it.
        def video_name(entry, media)
          [entry.record.name, media&.record&.data&.dig(:attributes, :filename), entry.record.id]
            .map(&:to_s).find { |name| !name.empty? }
        end

        # A file or folder name: a dataset's annotation file and image folder,
        # or a video's image folder. Names can repeat (duplicated entries,
        # datasets with the same name), so later ones get a numbered suffix.
        def unique_stem(name, taken, fallback)
          base = name.gsub(/[^\w.-]+/, "_")
          base = fallback if base.empty?

          stem = base
          suffix = 1
          stem = "#{base}_#{suffix += 1}" until taken.add?(stem)
          stem
        end
      end
    end
  end
end
