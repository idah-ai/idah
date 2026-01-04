module Export
  class UniversalPortableDataset
    def self.name
      "UniversalPortableDataset"
    end

    def initialize(context)
      @context = context
    end

    def run
      begin
        linear_processing
        # loop_processing
      rescue Exception => e
        Verse::logger::error{
          [
            "#{self} Error processing #{@context.io.filename} #{e}",
            [e, "#{e.backtrace.join("\n")}"].join("\n")
          ].join("\n")
        }
        raise e
      end
    end

    private
    def start
      Verse::logger::debug{"#{self} Start processing #{@context.io.filename}"}
      @context.io.puts({command: 'init', args: {}}.to_json)
    end

    def error(e, record)
      Verse::logger::error { "#{self} failed to process #{record}" }
      raise e
    end

    def done
      Verse::logger::debug{"#{self} #{@context.io.filename} Process complete"}
    end

    def linear_processing
      start
      @context.idah.datasets.each {|d| on_dataset(d) }
      @context.idah.entries.each {|e| on_entry(e) }
      @context.idah.annotations.each {|a| on_annotation(a) }
      done
    end

    def loop_processing
      start
      @context.idah.datasets.each do |dataset|
        on_dataset dataset
        dataset.entries.each do |entry|
          on_entry entry
          entry.annotations.each do |annotation|
            on_annotation annotation
          end
        end
      end
      done
    end

    def on_dataset(dataset)
      begin
        @context.io.puts({
          command: 'dataset:create',
          args: {
            id: dataset[:id],
            name: dataset[:attributes][:name],
            modality: dataset[:attributes][:modality],
            metadata: {
              "Created-At": dataset[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Updated-At": dataset[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Created-By": nil
            }
          }
        }.to_json)
      rescue Exception => e
        error e, dataset
      end
    end

    def on_entry(entry)
      begin
        Verse::logger::debug {entry.show}
        resource_info = entry.medias.resource_info
        file = Tempfile.new(entry[:attributes][:resource])
        begin
          file.write(entry.medias.files)
          file.close
          @context.io.puts({
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
        ensure
          file.close unless file.closed?
          file.unlink
        end
        @context.io.puts({
          command: 'entry:create',
          args: {
            id: entry[:id],
            dataset_id: entry[:attributes][:dataset_id],
            url: entry[:attributes][:resource],
            metadata: {
              "Created-At": entry[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Updated-At": entry[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Created-By": nil
            }
          }
        }.to_json)
      rescue Exception => e
        error e, entry
      end
    end

    def on_annotation(annotation)
      begin
        @context.io.puts({
          command: 'annotation:create',
          args: {
            id: annotation[:id],
            entry_id: annotation[:attributes][:entry_id],
            type: Hash(annotation[:attributes][:dimensions])[:type],
            shape: Hash(annotation[:attributes][:dimensions]).select {|k, _| k != :type}.to_json,
            annotation: Hash(annotation[:attributes][:annotation]).to_json,
            metadata: {
              "Created-At": annotation[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Updated-At": annotation[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Created-By": nil
            }
          }
        }.to_json)
      rescue Exception => e
        error e, annotation
      end
    end
  end
end
