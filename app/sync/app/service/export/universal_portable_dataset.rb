module Export
  class UniversalPortableDataset
    def initialize(context)
      puts context
      @context = context
      @files = []
    end

    def run
      # @context.updcli_append do |block|
      updcli_append do |&append|
        process_context &append
      end
    end

    private

    def process_context(&append)
      on_init &append
      @context.dataset.index.each do |dataset_context|
        process_dataset_context dataset_context, &append
      end
    end

    def process_dataset_context(dataset_context, &append)
      on_dataset_context dataset_context, &append
      dataset_context.entry.index.each do |entry_context|
        process_entry_context entry_context, &append
      end
    end

    def process_entry_context(entry_context, &append)
      on_entry_context entry_context, &append
      entry_context.annotation.index.each do |annotation_context|
        process_annotation_context annotation_context, &append
      end
    end

    def process_annotation_context(annotation_context, &append)
      on_annotation_context annotation_context, &append
    end

    def on_init(&append)
      append.call({command: 'init', args: {}}.to_json)
    end

    def on_dataset_context(dataset_context, &append)
      append.call({
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

    def on_entry_context(entry_context, &append)
      # @context.Tempfile.new(entry_context.entry[:attributes][:resource])
      file = Tempfile.new(entry_context.entry[:attributes][:resource])
      file.write(entry_context.media_file)
      file.close
      @files << file
      append.call({
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
      append.call({
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

    def on_annotation_context(annotation_context, &append)
      append.call({
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

    def updcli_append(&process_append_records)
      Open3.popen3(
        "bin/datset-static", # TODO: build or embed binary within plugin
        "-i", [@context.name, :upd].join('.'),
        "append"
      ) do |stdin, stdout, stderr, wait_thr|
        stdout_thr = Thread.new do # todo read some expectation in block.call instead or risk throughput bottleneck
          until (line = stdout.gets).nil?
            Verse.logger.info { "#{line.strip}"}
          end
        end

        begin
          process_append_records.call do |s|
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
end
