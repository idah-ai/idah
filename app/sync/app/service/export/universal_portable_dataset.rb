module Export
  class UniversalPortableDataset
    def initialize(context)
      @context = context
      @files = []
    end

    def run
      # TODO embed append/std_* in context
      updcli_append do |&append|
        linear_processing &append
        # inner_loop_processing &append
      end
    end

    private

    def linear_processing(&append)
      begin
        start &append
        @context.datasets.index.each do |dataset_context|
          on_dataset dataset_context, &append
        end
        @context.entries.index.each do |entry_context|
          on_entry entry_context, &append
        end
        @context.annotations.index.each do |annotation_context|
          on_annotation annotation_context, &append
        end
        done &append
      rescue Exception => e
        Verse::logger::error{"#{self} Error while processing #{@context.name} #{e}"}
      end
    end


    def inner_loop_processing(&append)
      begin
        start &append
        @context.datasets.index.each do |dataset_context|
          process_dataset dataset_context, &append
        end
        done &append
      rescue Exception => e
        Verse::logger::error{"#{self} Error while processing #{@context.name} #{e}"}
      end
    end

    def process_dataset(dataset_context, &append)
      on_dataset dataset_context, &append
      dataset_context.entries.index.each do |entry_context|
        process_entry entry_context, &append
      end
    end

    def process_entry(entry_context, &append)
      on_entry entry_context, &append
      entry_context.annotations.index.each do |annotation_context|
        process_annotation annotation_context, &append
      end
    end

    def process_annotation(annotation_context, &append)
      on_annotation annotation_context, &append
    end

    def start(&append)
      Verse::logger::debug{"#{self} Start processing #{@context.name}"}
      append.call({command: 'init', args: {}}.to_json)
    end

    def on_dataset(dataset_context, &append)
      append.call({
        command: 'dataset:create',
        args: {
          id: dataset_context.record[:id],
          name: dataset_context.record[:attributes][:name],
          modality: dataset_context.record[:attributes][:modality],
          metadata: {
            "Created-At": dataset_context.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": dataset_context.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": nil
          }
        }
      }.to_json)
    end

    def on_entry(entry_context, &append)
      file = Tempfile.new(entry_context.record[:attributes][:resource])
      file.write(entry_context.medias.files)
      file.close
      @files << file
      resource_info = entry_context.medias.resource_info
      append.call({
        command: 'media:create',
        args: {
          id: resource_info[:id],
          key: resource_info[:attributes][:key],
          file: file.path,
          mimetype: resource_info[:attributes][:mime_type],
          metadata: {
            "Created-At": resource_info[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": resource_info[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": resource_info[:attributes][:created_by]
          }
        }
      }.to_json)
      append.call({
        command: 'entry:create',
        args: {
          id: entry_context.record[:id],
          dataset_id: entry_context.record[:attributes][:dataset_id],
          url: entry_context.record[:attributes][:resource],
          metadata: {
            "Created-At": entry_context.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": entry_context.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": nil
          }
        }
      }.to_json)
    end

    def on_annotation(annotation_context, &append)
      append.call({
        command: 'annotation:create',
        args: {
          id: annotation_context.record[:id],
          entry_id: annotation_context.record[:attributes][:entry_id],
          type: Hash(annotation_context.record[:attributes][:dimensions])[:type],
          shape: Hash(annotation_context.record[:attributes][:dimensions]).select {|k, _| k != :type}.to_json,
          annotation: Hash(annotation_context.record[:attributes][:annotation]).to_json,
          metadata: {
            "Created-At": annotation_context.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": annotation_context.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": nil
          }
        }
      }.to_json)
    end

    def done
      Verse::logger::debug{"#{self} #{@context.name} Process complete"}
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
          process_append_records.call(stdin, stdout, stderr, wait_thr) do |s|
            stdin.puts(s)
            stdin.flush
            Verse::logger::debug {"#{self}: #{s}"}
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
