# frozen_string_literal: true

module Export
  class Job < Jobs::Base
    attr_reader :dataset_id

    def run_impl
      @dataset_id = arguments.fetch(:dataset_id)

      DuckDB::Database.open(['export',dataset_id, DateTime.now.to_s.split(' ').join('_'), 'upd'].join('.')) do |db|
        db.connect do |con|
          con.query("
            CREATE TABLE IF NOT EXISTS metadata (
              key VARCHAR NOT NULL PRIMARY KEY CHECK(length(key) <= 64),
              value VARCHAR NOT NULL
            );")
          con.query("
            CREATE TABLE IF NOT EXISTS datasets (
              id VARCHAR NOT NULL PRIMARY KEY CHECK(length(id) <= 64),
              name VARCHAR NOT NULL CHECK(length(name) <= 64),
              modality VARCHAR NOT NULL CHECK(length(modality) <= 64),
              metadata VARCHAR DEFAULT '{}'
              );")
          con.query("
            CREATE TABLE IF NOT EXISTS entries (
                id VARCHAR NOT NULL PRIMARY KEY CHECK(length(id) <= 64),
                dataset_id VARCHAR NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
                media_url VARCHAR NOT NULL,
                metadata VARCHAR DEFAULT '{}'
            );")
          con.query("CREATE INDEX IF NOT EXISTS idx_entries_dataset_id ON entries (dataset_id);")
          con.query("
            CREATE TABLE IF NOT EXISTS medias (
              id VARCHAR NOT NULL CHECK(length(id) <= 64),
              key VARCHAR NOT NULL CHECK(length(key) <= 256),
              blob_data BLOB,
              media_type VARCHAR CHECK(length(media_type) <= 64),
              metadata VARCHAR DEFAULT '{}',
              PRIMARY KEY (id, key)
            );")
          con.query("
            CREATE TABLE IF NOT EXISTS annotations (
              id VARCHAR NOT NULL PRIMARY KEY CHECK(length(id) <= 64),
              entry_id VARCHAR NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
              shape_type VARCHAR NOT NULL CHECK(length(shape_type) <= 64),
              shape_args VARCHAR NOT NULL,
              annotation VARCHAR NOT NULL,
              metadata VARCHAR DEFAULT '{}'
            );")
          con.query("CREATE INDEX IF NOT EXISTS idx_annotations_entry_id ON annotations (entry_id);")
          con.query("CREATE INDEX IF NOT EXISTS idx_annotations_shape_type ON annotations (shape_type);")

          dataset_response = Api[:idah].dataset.datasets.show(id: @dataset_id)
          raise if dataset_response.errors

          dataset = dataset_response.data

          con.query(
            'INSERT INTO datasets VALUES ($id, $name, $modality, $metadata)',
              id: dataset[:id],
              name: dataset[:attributes][:name],
              modality: dataset[:attributes][:modality],
              metadata: {
                "Created-At": dataset[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                "Updated-At": dataset[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                "Created-By": nil #,
                "Content-Signature": {
                  signature: "<base64-encoded ECDSA signature>",
                  dataHashAlgorithm: "<hash algorithm name>",
                  dataHash: "<hex-encoded hash of the data payload>",
                  schemaHash: "<hex-encoded hash of the schema>",
                  certificate: "<base64-encoded X.509 certificate>",
                  curve: "<ECDSA curve name>",
                  signedAt: "<ISO 8601 timestamp>",
                  signedFlavorTables: ["<table_name_1>", "<table_name_2>"]
                }
              }.to_json
          )

          entry_page = 1

          while (entries_response = Api[:idah].dataset.entries.index(
            filters: {dataset_id: @dataset_id},
            page: {number: entry_page, size: 100}, query_count: false)
          ) do
            raise if entries_response.errors

            break if entries_response.data.empty?

            entries_response.data.each do |entry|
              annotation_page = 1
              media_response = Api[:idah].media.medias.resource_info(resource: entry[:attributes][:resource]) # ? seems loose
              raise if media_response.errors

              media = media_response.data

              con.query(
                'INSERT INTO medias VALUES ($id, $key, $blob_data, $media_type, $metadata)',
                  id: media[:id],
                  key: media[:attributes][:key],
                  blob_data: nil,
                  media_type: media[:attributes][:mime_type],
                  metadata: {
                    "Created-At": media[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                    "Updated-At": media[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                    "Created-By": media[:attributes][:created_by]
                  }.to_json
              )
              con.query('INSERT INTO entries VALUES ($id, $dataset_id, $media_url, $metadata)',
                id: entry[:id],
                dataset_id: entry[:attributes][:dataset_id], # dataset_id
                media_url: entry[:attributes][:resource], #?
                metadata: {
                  "Created-At": entry[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Updated-At": entry[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                  "Created-By": nil ##
                }.to_json
              )
              while (annotations_response = Api[:idah].dataset.annotations.index(
                filters: {entry_id: entry[:id]},
                page: {number: annotation_page, size: 100}, query_count: false)
              ) do
                raise if annotations_response.errors

                break if annotations_response.data.empty?

                annotations_response.data.each do |annotation|
                  con.query('INSERT INTO annotations VALUES ($id, $entry_id, $shape_type, $shape_args, $annotation, $metadata)',
                    id: annotation[:id],
                    entry_id: annotation[:attributes][:entry_id], # entry[:id]
                    shape_type: Hash(annotation[:attributes][:dimensions])[:type],
                    shape_args: Hash(annotation[:attributes][:dimensions]).select {|k, _| k != :type}.to_json,
                    annotation: Hash(annotation[:attributes][:annotation]).to_json,
                    metadata: {
                      "Created-At": annotation[:attributes][:created_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                      "Updated-At": annotation[:attributes][:updated_at]&.gsub(/ (\+\d{2})(\d{2})/, '\1:\2'),
                      "Created-By": annotation[:attributes][:created_by_email]
                    }.to_json
                  )
                end
                annotation_page += 1
              end
            end
            entry_page += 1
          end

        end
      end
    end
  end
end
