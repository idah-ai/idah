# frozen_string_literal: true

require "json"
require "tempfile"
require "fileutils"

module IdahVideo
  module Export
    module Coco
      # Writes a COCO instances file: info, licenses, categories, videos, images
      # and annotations. `videos` is the list COCO video datasets add.
      #
      # A long video yields thousands of images and annotations, so they are
      # appended to temporary files as they come and copied into the final JSON
      # on `close`. Nothing is written at `path` before then.
      class Writer
        def initialize(path)
          @path = path
          @videos = []
          @images = Tempfile.new(["coco-images", ".jsonl"])
          @annotations = Tempfile.new(["coco-annotations", ".jsonl"])
          @image_count = 0
          @annotation_count = 0
        end

        def empty? = @image_count.zero?

        # Each `add_*` returns the id it gave the record, counted from 1.
        def add_video(video)
          @videos << { id: @videos.size + 1 }.merge(video)
          @videos.size
        end

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
            out.write(%("licenses":[],))
            out.write(%("categories":#{JSON.generate(categories)},))
            out.write(%("videos":#{JSON.generate(@videos)},))
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
            year: now.year
          }
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
end
