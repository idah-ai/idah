# frozen_string_literal: true

require "open3"
require "tmpdir"
require "fileutils"

module IdahVideo
  module Export
    module Helpers
      # Extracts frames of a video as JPEG images, in one ffmpeg pass.
      #
      # Frame n is the n-th decoded frame, from 0. The frontend shows frame f at
      # f / fps, which is the same frame for constant frame rate videos.
      module FrameExtractor
        extend self

        # @param video_path [String] the original video
        # @param frames [Array<Integer>] sorted, unique frame numbers
        # @param output_dir [String] where `frame_NNNNNN.jpg` files go
        # @return [Array<Integer>] the frames written; frames past the end of the
        #   video are left out
        def extract(video_path, frames, output_dir)
          return [] if frames.empty?

          Dir.mktmpdir("idah-frames-") do |staging|
            run_ffmpeg(video_path, frames, staging)

            # ffmpeg numbers its output 1, 2, 3... in frame order; the k-th
            # image is the k-th requested frame.
            images = Dir.children(staging).sort
            written = frames.first(images.size)

            FileUtils.mkdir_p(output_dir)
            written.zip(images).each do |frame, image|
              FileUtils.mv(File.join(staging, image), File.join(output_dir, format("frame_%06d.jpg", frame)))
            end

            written
          end
        end

        # Consecutive frames as ranges, which keeps ffmpeg's select expression
        # short when a track covers thousands of frames.
        def ranges(frames)
          frames.slice_when { |a, b| b != a + 1 }.map { |run| run.first..run.last }
        end

        private

        def run_ffmpeg(video_path, frames, staging)
          selection = ranges(frames).map { |r| "between(n,#{r.first},#{r.last})" }.join("+")

          _, err, status = Open3.capture3(
            "ffmpeg",
            "-v",
            "error",
            "-i",
            video_path,
            "-map",
            "0:v:0",
            "-vf",
            "select='#{selection}'",
            # One image per selected frame: no frame dropped or duplicated.
            "-fps_mode",
            "passthrough",
            "-q:v",
            "2",
            File.join(staging, "%08d.jpg")
          )

          raise "ffmpeg could not extract frames from #{File.basename(video_path)}: #{err.strip}" unless status.success?
        end
      end
    end
  end
end
