require "open3"

module IdahVideo
  module Processor
    module Ffprobe
      extend self

      def identity(path)
        json = nil

        Open3.popen3(
          "ffprobe", "-v", "quiet", "-print_format",
          "json", "-show_format", "-show_streams", path
        ) do |_, stdout, stderr, wait_thr|
          json = stdout.read

          result = wait_thr.value

          if wait_thr.value != 0
            err = stderr.read

            raise "Failed to execute ffprobe: #{result}\n#{err}"
          end
        end

        JSON.parse(json, symbolize_names: true)
      end
    end
  end
end
