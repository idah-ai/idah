# frozen_string_literal: true

require "open3"
require "json"

module IdahImage
  module Processor
    module Ffprobe
      extend self

      def identity(path)
        json = nil
        path = File.absolute_path(path)

        args = [
          "-v", "verbose",
          "-print_format", "json",
          "-show_format",
          "-show_streams",
          "-probesize", "100M",
          "-analyzeduration", "100M",
          "-max_pixels", "2147483647",
          "-max_alloc", "0",
          path
        ]

        Open3.popen3("ffprobe", *args) do |_, stdout, stderr, wait_thr|
          out_t = Thread.new { stdout.read }
          err_t = Thread.new { stderr.read }

          result = wait_thr.value
          json = out_t.value
          err = err_t.value

          unless result.success?
            error = "Failed to execute `ffprobe #{args.join(" ")}`: #{result}\n#{err}"
            Verse.logger&.error { error }
            raise error
          end
        end

        JSON.parse(json, symbolize_names: true)
      end
    end
  end
end
