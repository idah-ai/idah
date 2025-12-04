module Export
  class UniversalPortableDataset
    attr_reader :context
    def initialize(context)
      @context = context
    end

    def run
      Open3.popen3(
        "bin/datset-static", # TODO: build or embed binary within plugin
        "-i", [:export, context.name, Time.now.to_i, :upd].join('.'),
        "append"
      ) do |stdin, stdout, stderr, wait_thr|
        stdin.puts({command: 'init', args: {}}.to_json)

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
              }.to_json
            }
          }.to_json)

          dataset_context.entries.each do |entry_context|
            # stdin.puts({
            #   command: 'media:create',
            #   args: {
            #     id: entry_context.media[:id],
            #     key: entry_context.media[:attributes][:key],
            #     file: entry_context.file.path,
            #     mimetype: entry_context.media[:attributes][:mime_type],
            #     metadata: {
            #       "Created-At": entry_context.media[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            #       "Updated-At": entry_context.media[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
            #       "Created-By": entry_context.media[:attributes][:created_by]
            #     }.to_json
            #   }
            # }.to_json)
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
                }.to_json
              }
            }.to_json)

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
                  }.to_json
                }
              }.to_json)
            end
          end

          # todo >>>
          stdin.close
          value = wait_thr.value
          error = stderr.read
          if !error.empty? #  TODO review return value && raise on time
            raise RuntimeError, error
          else
            puts stdout.read
          end
          # <<< todo
        end
      end
    end
  end
end