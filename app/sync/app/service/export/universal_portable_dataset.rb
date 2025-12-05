module Export
  class UniversalPortableDataset
    attr_reader :context
    def initialize(context)
      @context = context
    end

    def run
      Open3.popen3(
        "bin/datset-static", # TODO: build or embed binary within plugin
        "-i", [context.name, :upd].join('.'),
        "append"
      ) do |stdin, stdout, stderr, wait_thr|
        stdout_thr = Thread.new do
          stdout.readline do |line|
            Verse.logger.info {"#{line.chomp}"}
          end
        end

        files = []
        begin
          stdin.puts({command: 'init', args: {}}.to_json)
          stdin.flush

          context.datasets.each do |dataset_context|
            stdin.puts({
              command: 'dataset:create',
              args: {
                id: dataset_context.dataset[:id],
                name: dataset_context.dataset[:attributes][:name],
                modality: dataset_context.dataset[:attributes][:modality],
                metadata: {
                  "Created-At": dataset_context.dataset[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Updated-At": dataset_context.dataset[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Created-By": nil
                }
              }
            }.to_json)
            stdin.flush
            dataset_context.entries.each do |entry_context|
              file = Tempfile.new(entry_context.entry[:attributes][:resource])
              file.write(entry_context.media_file)
              file.close
              files << file
              stdin.puts({
                command: 'media:create',
                args: {
                  id: entry_context.media_info[:id],
                  key: entry_context.media_info[:attributes][:key],
                  file: file.path,
                  mimetype: entry_context.media_info[:attributes][:mime_type],
                  metadata: {
                    "Created-At": entry_context.media_info[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                    "Updated-At": entry_context.media_info[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                    "Created-By": entry_context.media_info[:attributes][:created_by]
                  }
                }
              }.to_json)
              stdin.flush
              stdin.puts({
                command: 'entry:create',
                args: {
                  id: entry_context.entry[:id],
                  dataset_id: entry_context.entry[:attributes][:dataset_id],
                  url: entry_context.entry[:attributes][:resource],
                  metadata: {
                    "Created-At": entry_context.entry[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                    "Updated-At": entry_context.entry[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                    "Created-By": nil
                  }
                }
              }.to_json)
              stdin.flush
              entry_context.annotations.each do |annotation_context|
                stdin.puts({
                  command: 'annotation:create',
                  args: {
                    id: annotation_context.annotation[:id],
                    entry_id: annotation_context.annotation[:attributes][:entry_id],
                    type: Hash(annotation_context.annotation[:attributes][:dimensions])[:type],
                    shape: Hash(annotation_context.annotation[:attributes][:dimensions]).select {|k, _| k != :type}.to_json,
                    annotation: Hash(annotation_context.annotation[:attributes][:annotation]).to_json,
                    metadata: {
                      "Created-At": annotation_context.annotation[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                      "Updated-At": annotation_context.annotation[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                      "Created-By": nil
                    }
                  }
                }.to_json)
                stdin.flush
              end
            end
          end
        ## todo review VVV
        rescue Exception => e
          Verse.logger.error {"UPD export error:#{e}"}
          raise e
        ensure
          stdout_thr.join
          stdin.close
          if wait_thr.value.exitstatus != 0
            raise "updcli error #{wait_thr.value} #{stderr.read}"
          end
          files.each &:unlink # earlier ?
          # why isnt it flushed within thread ?
          # (updcli STDOUT/STDERR newline flushed ?, open3?pty?)
          Verse::logger.info { "UPD export unflushed Logs...\n#{stdout.read}" }
          Verse::logger.info { "UPD export done: #{wait_thr.value}" }
        end
      end
    end
  end
end