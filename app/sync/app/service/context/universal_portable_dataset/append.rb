module Context
  module UniversalPortableDataset
    module Append
      Context = Data.define(:name, :stdin, :stdout, :stderr, :wait_thr, :append)
      def self.prepare(name)
        filename = [name, :upd].join('.')
        Open3.popen3(
          "bin/datset-static", # TODO: build or embed binary within plugin
          "-i", filename,
          "append"
        ) do |stdin, stdout, stderr, wait_thr|
          stdout_thr = Thread.new do
            # todo read/delegate_read some expectation in block.call instead
            # or risk throughput bottleneck
            until (line = stdout.gets).nil?
              Verse.logger.info { "#{line.strip}"}
            end
          end
          begin
            yield Context.new(
              name, stdin, stdout, stderr, wait_thr,
              proc do |s|
                stdin.puts(s)
                stdin.flush
              Verse::logger::debug {"#{self}: #{s}"}
            end)
          rescue Exception => e
            Verse.logger.error {"UPD export error:#{e}"}
            raise e
          ensure
            stdin.close
            stdout_thr.join
            error = stderr.read
            value = wait_thr.value
            if value.exitstatus != 0
              raise "updcli error #{value} #{error}"
            end
            @files.each &:unlink # earlier ?
            Verse::logger.info { "UPD export done: #{value}" }
          end
        end
      end
    end
  end
end