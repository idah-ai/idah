# frozen_string_literal: true

require "open3"

module IdahVideo
  module Processor
    module Ffprobe
      extend self

      def identity(path)
        json = nil

        path = File.absolute_path(path)

        args = [
          "-v",
          "quiet",
          "-print_format",
          "json",
          "-show_format",
          "-show_streams",
          path
        ]

        Open3.popen3(
          "ffprobe", *args
        ) do |_, stdout, stderr, wait_thr|
          json = stdout.read

          result = wait_thr.value

          if wait_thr.value != 0
            err = stderr.read

            error = "Failed to execute `ffprobe #{args.join(" ")}`: #{result}\n#{err}"
            Verse.logger&.error{ error }
            raise error
          end
        end

        JSON.parse(json, symbolize_names: true)
      end
    end
  end
end
