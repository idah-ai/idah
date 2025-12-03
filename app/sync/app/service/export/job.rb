# frozen_string_literal: true

module Export
  class Job < Jobs::Base
    attr_reader :dataset_id

    def run_impl
      @dataset_id = arguments.fetch(:dataset_id)

      Open3.popen3(
        "bin/datset-static",
        "-i", ['export', dataset_id, Time.now.to_i, 'upd'].join('.'),
        "append"
        ) do |stdin, stdout, stderr, wait_thr|
        stdin.puts({command: 'init', args: {}}.to_json)

        dataset_response = Api[:idah].dataset.datasets.show(id: @dataset_id)
        raise dataset_response.errors if dataset_response.errors

        dataset = dataset_response.data

        stdin.puts({
          command: 'dataset:create',
          args: {
            id: dataset[:id],
            name: dataset[:attributes][:name],
            modality: dataset[:attributes][:modality],
            metadata: {
              "Created-At": dataset[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Updated-At": dataset[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
              "Created-By": nil
            }.to_json
          }
        }.to_json)

        entry_page = 1
        while (entries_response = Api[:idah].dataset.entries.index(
          filters: {dataset_id: @dataset_id},
          page: {number: entry_page, size: 100}, query_count: false)
        ) do
          raise if entries_response.errors

          break if entries_response.data.empty?

          entries_response.data.each do |entry|
            annotation_page = 1
            media_response = Api[:idah].media.medias.resource_info(
              resource: entry.data[:attributes][:resource]
            ) # ? seems loose

            raise if media_response.errors

            media = media_response.data
            file_response = Api[:idah].media.medias.files(
              resource: entry.data[:attributes][:resource]
            )
            # raise if errors ?

            file = Tempfile.new(entry.data[:attributes][:resource])
            file.write(file_response)
            file.close

            stdin.puts({
              command: 'media:create',
              args: {
                id: media[:id],
                key: media[:attributes][:key],
                file: file.path,
                mimetype: media[:attributes][:mime_type],
                metadata: {
                  "Created-At": media[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Updated-At": media[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Created-By": media[:attributes][:created_by]
                }.to_json
              }
            }.to_json)

            stdin.puts({
              command: 'entry:create',
              args: {
                id: entry.data[:id],
                dataset_id: entry.data[:attributes][:dataset_id],
                url: entry.data[:attributes][:resource],
                metadata: {
                  "Created-At": entry[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Updated-At": entry[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Created-By": nil
                }.to_json
              }
            }.to_json)

            while (annotations_response = Api[:idah].dataset.annotations.index(
              filters: {entry_id: entry.data[:id]},
              page: {number: annotation_page, size: 100}, query_count: false)
            ) do
              raise annotations_response.errors if annotations_response.errors

              break if annotations_response.data.empty?

              annotations_response.data.each do |annotation|
                stdin.puts({
                  command: 'annotation:create',
                  args: {
                    id: annotation.data[:id],
                    entry_id: annotation.data[:attributes][:entry_id],
                    type: Hash(annotation.data[:attributes][:dimensions])[:type],
                    shape: Hash(annotation.data[:attributes][:dimensions]).select {|k, _| k != :type}.to_json,
                    annotation: Hash(annotation.data[:attributes][:annotation]).to_json,
                    metadata: {
                      "Created-At": annotation[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                      "Updated-At": annotation[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                      "Created-By": nil
                    }.to_json
                  }
                }.to_json)
              end
              annotation_page += 1
            end
          end
          entry_page += 1
        end

        stdin.close
        value = wait_thr.value
        error = stderr.read
        if !error.empty? #  TODO review return value && raise on time
          raise RuntimeError, error
        else
          puts stdout.read
        end
      end

    end
  end
end
