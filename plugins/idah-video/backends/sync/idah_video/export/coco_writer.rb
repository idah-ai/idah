# frozen_string_literal: true

require "json"
require "tempfile"
require "fileutils"

module IdahVideo
  module Export
    # Writes a COCO instances file shaped like CVAT's COCO 1.0.
    #
    # CVAT reads COCO with a streaming parser that rejects any top-level key
    # besides info, licenses, categories, images and annotations, so extra
    # data, such as the video's details, goes inside `info`.
    #
    # A long video yields thousands of images and annotations, so they are
    # appended to temporary files as they come and copied into the final JSON
    # on `close`. Nothing is written at `path` before then.
    class CocoWriter
      # @param video [Hash, nil] written as `info.video`
      def initialize(path, video: nil)
        @path = path
        @video = video
        @images = Tempfile.new(["coco-images", ".jsonl"])
        @annotations = Tempfile.new(["coco-annotations", ".jsonl"])
        @image_count = 0
        @annotation_count = 0
      end

      # Each `add_*` returns the id it gave the record, counted from 1.
      def add_image(image)
        @image_count += 1
        @images.puts(JSON.generate({ id: @image_count }.merge(image)))
        @image_count
      end

      def add_annotation(annotation)
        @annotation_count += 1
        @annotations.puts(JSON.generate({ id: @annotation_count }.merge(annotation)))
        @annotation_count
      end

      def close(categories:)
        FileUtils.mkdir_p(File.dirname(@path))

        File.open(@path, "w") do |out|
          out.write("{")
          out.write(%("info":#{JSON.generate(info)},))
          out.write(%("licenses":#{JSON.generate([{ name: "", id: 0, url: "" }])},))
          out.write(%("categories":#{JSON.generate(categories)},))
          out.write(%("images":))
          copy_list(@images, out)
          out.write(%(,"annotations":))
          copy_list(@annotations, out)
          out.write("}")
        end
      ensure
        discard
      end

      def discard
        [@images, @annotations].each(&:close!)
      end

      private

      def info
        now = Time.now.utc

        {
          contributor: "IDAH",
          date_created: now.iso8601,
          description: "IDAH export",
          url: "",
          version: "1.0",
          year: now.year,
          video: @video
        }.compact
      end

      def copy_list(file, out)
        file.flush
        file.rewind

        out.write("[")
        file.each_line.with_index do |line, i|
          out.write(",") unless i.zero?
          out.write(line.chomp)
        end
        out.write("]")
      end
    end
  end
end
