module Context
  module Io
    class UniversalPortableDataset < Base
      def initialize(args = nil, filters = nil, opts = nil)
        filename = [Hash(args).dig(:name) || ["export.UniversalPortableDataset", Time.now.to_i], :upd].join(".")
        stdin, stdout, stderr, wait_thr = Open3.popen3(
          "bin/datset-static",
          "-i", filename,
          "append"
        )
        super(filename, stdin, stdout, stderr, wait_thr)
      end

      def append(s, expected_lines = 1, feedback = proc{|line|line})
        i.puts(s)
        i.flush
        readers = [o, e]
        lines_read, stderr_output = 0, []
        while lines_read < expected_lines && !readers.empty?
          ready = IO.select(readers, nil, nil, 0.1)
          ready[0].each do |fd|
            line = fd.gets
            if line
              if fd == o
                feedback.call(line)
                lines_read += 1
              elsif fd == e
                stderr_output << line
              end
            else
              readers.delete(fd)
            end
          end if ready
          break Verse.logger.warn { "blocking read on: #{s}" } if ready.nil? && lines_read == 0
        end
        unless stderr_output.empty?
          Verse.logger.error { "stderr: #{stderr_output.join}" }
          raise "stderr output detected: #{stderr_output.join}"
        end
      end
    end
  end
end