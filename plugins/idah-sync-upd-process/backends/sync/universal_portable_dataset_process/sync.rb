module UniversalPortableDatasetProcess
  class Sync
    def initialize(context)
      @context = context
      @files = []
    end

    def open(&block)
      Open3.popen3(
        "bin/datset-static", # TODO: build or embed binary within plugin
        "-i", [@context.name, :upd].join('.'),
        "append"
      ) do |stdin, stdout, stderr, wait_thr|
        stdout_thr = Thread.new do
          until (line = stdout.gets).nil?
            Verse.logger.info { "#{line.strip}"}
          end
        end

        begin
          yield do |s|
            stdin.puts(s)
            stdin.flush
          end

          [@context.name, :upd].join('.')
          ## todo review VVV
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

    def on_dataset(dataset_context, &block)
      yield({
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
    end

    def on_entry(entry_context, &block)
      file = Tempfile.new(entry_context.entry[:attributes][:resource])
      file.write(entry_context.media_file)
      file.close
      @files << file
      yield({
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
      yield({
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
    end

    def on_annotation(annotation_context, &block)
      yield({
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
    end

    def on_close
      # ?
    end


    def run
      open do |&block|
        process &block
      end
    end

    private

    def process(&block)
      yield({command: 'init', args: {}}.to_json)

      @context.datasets.each do |dataset_context|
        process_dataset_context dataset_context, &block
      end
    end

    def process_dataset_context(dataset_context, &block)
      on_dataset dataset_context, &block
      dataset_context.entries.each do |entry_context|
        process_entry_context entry_context, &block
      end
    end

    def process_entry_context(entry_context, &block)
      on_entry entry_context, &block
      entry_context.annotations.each do |annotation_context|
        process_annotation_context annotation_context, &block
      end
    end

    def process_annotation_context(annotation_context, &block)
      on_annotation annotation_context, &block
    end
  end
end
