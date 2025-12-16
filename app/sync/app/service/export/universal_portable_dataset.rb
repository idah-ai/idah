module Export
  class UniversalPortableDataset
    def initialize(context)
      @context = context
    end

    def run
      begin
        # linear_processing
        loop_processing
      rescue Exception => e
        Verse::logger::error{"#{self} Error processing #{@context.io.name} #{e}"}
        raise e
      end
    end

    private
    def start
      Verse::logger::debug{"#{self} Start processing #{@context.io.name}"}
      @context.io.append.call({command: 'init', args: {}}.to_json)
    end

    def error(e, record)
      Verse::logger::error {
        "#{self} failed to process #{[record[:type], record[:id]].join(":")}"
      }
      raise e
    end

    def done
      Verse::logger::debug{"#{self} #{@context.io.name} Process complete"}
    end

    def linear_processing
      start
      @context.api.datasets.index.each do |dataset| on_dataset dataset end
      @context.api.entries.index.each do |entry| on_entry entry end
      @context.api.annotations.index.each do |annotation| on_annotation annotation end
      done
    end

    def loop_processing
      start
      @context.api.datasets.index.each do |dataset|
        on_dataset dataset
        dataset.entries.index.each do |entry|
          on_entry entry
          entry.annotations.index.each do |annotation|
            on_annotation annotation
          end
        end
      end
      done
    end

    def on_dataset(dataset)
      begin
        @context.io.append.call({
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
      rescue Exception => e
        error e, dataset.record
      end
    end

    def on_entry(entry)
      begin
        resource_info = entry.medias.resource_info
        file = Tempfile.new(entry.record[:attributes][:resource])
        begin
          file.write(entry.medias.files)
          file.close
          @context.io.append.call({
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
        @context.io.append.call({
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
      rescue Exception => e
        error e, entry.record
      end
    end

    def on_annotation(annotation)
      begin
        @context.io.append.call({
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
      rescue Exception => e
        error e, annotation.record
      end
    end
  end
end
