module Export
  class UniversalPortableDataset
    def initialize(context)
      @context = context
      @files = []
    end

    def run
      # TODO embed append/std_* in context
      updcli_append do |&append|
        begin
          linear_processing &append
          # loop_processing &append
        rescue Exception => e
          Verse::logger::error{"#{self} Error processing #{@context.name} #{e}"}
          raise e
        end
      end
    end

    private

    def start(&append)
      Verse::logger::debug{"#{self} Start processing #{@context.name}"}
      append.call({command: 'init', args: {}}.to_json)
    end

    def done
      Verse::logger::debug{"#{self} #{@context.name} Process complete"}
    end

    def linear_processing(&append)
      start &append
      @context.api.datasets.index.each do |dataset|
        on_dataset dataset, &append
      end
      @context.api.entries.index.each do |entry|
        on_entry entry, &append
      end
      @context.api.annotations.index.each do |annotation|
        on_annotation annotation, &append
      end
      done &append
    end

    def loop_processing(&append)
      start &append
      @context.api.datasets.index.each do |dataset|
        process_dataset dataset, &append
      end
      done &append
    end

    def process_dataset(dataset, &append)
      on_dataset dataset, &append
      dataset.entries.index.each do |entry|
        process_entry entry, &append
      end
    end

    def process_entry(entry, &append)
      on_entry entry, &append
      entry.annotations.index.each do |annotation|
        process_annotation annotation, &append
      end
    end

    def process_annotation(annotation, &append)
      on_annotation annotation, &append
    end

    def on_dataset(dataset, &append)
      append.call({
        command: 'dataset:create',
        args: {
          id: dataset.record[:id],
          name: dataset.record[:attributes][:name],
          modality: dataset.record[:attributes][:modality],
          metadata: {
            "Created-At": dataset.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": dataset.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": nil
          }
        }
      }.to_json)
    end

    def on_entry(entry, &append)
      file = Tempfile.new(entry.record[:attributes][:resource])
      file.write(entry.medias.files)
      file.close
      @files << file
      resource_info = entry.medias.resource_info
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
          id: entry.record[:id],
          dataset_id: entry.record[:attributes][:dataset_id],
          url: entry.record[:attributes][:resource],
          metadata: {
            "Created-At": entry.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": entry.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": nil
          }
        }
      }.to_json)
    end

    def on_annotation(annotation, &append)
      append.call({
        command: 'annotation:create',
        args: {
          id: annotation.record[:id],
          entry_id: annotation.record[:attributes][:entry_id],
          type: Hash(annotation.record[:attributes][:dimensions])[:type],
          shape: Hash(annotation.record[:attributes][:dimensions]).select {|k, _| k != :type}.to_json,
          annotation: Hash(annotation.record[:attributes][:annotation]).to_json,
          metadata: {
            "Created-At": annotation.record[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Updated-At": annotation.record[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            "Created-By": nil
          }
        }
      }.to_json)
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
