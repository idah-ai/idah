module Context
  module UniversalPortableDataset
    module Append
      Context = Data.define(:name, :stdin, :stdout, :stderr, :wait_thr, :append)

      def self.prepare(name, &block)
        filename = [name, :upd].join('.')
        Open3.popen3(
          "bin/datset-static",
          "-i", filename,
          "append"
        ) do |stdin, stdout, stderr, wait_thr|
          begin
            yield Context.new(
              filename, stdin, stdout, stderr, wait_thr,
              proc do |s, expected_lines = 1, feedback = proc{|line| line}|
                stdin.puts(s)
                stdin.flush
                readers = [stdout, stderr]
                lines_read = 0
                stderr_output = []
                while lines_read < expected_lines && !readers.empty?
                  ready = IO.select(readers, nil, nil, 0.1) # 0.1s timeout
                  if ready
                    ready[0].each do |fd|
                      line = fd.gets
                      if line
                        if fd == stdout
                          feedback.call(line)
                          lines_read += 1
                        elsif fd == stderr
                          stderr_output << line
                        end
                      else
                        readers.delete(fd)
                      end
                    end
                  end
                  break Verse.logger.warn { "blocking read on: #{s}" } if ready.nil? && lines_read == 0
                end
                unless stderr_output.empty?
                  Verse.logger.error { "stderr: #{stderr_output.join}" }
                  raise "stderr output detected: #{stderr_output.join}"
                end
              end
            )
          rescue Exception => e
            Verse.logger.error { "UPD export error: #{e}" }
            raise e
          ensure
            stdin.close
            remaining_stderr = []
            while (line = stderr.gets)
              remaining_stderr << line
            end
            value = wait_thr.value
            if value.exitstatus != 0
              raise "updcli error #{value} #{remaining_stderr.join}"
            end
            Verse.logger.info { "UPD export done: #{value}" }
          end
        end
      end
    end
  end
end
