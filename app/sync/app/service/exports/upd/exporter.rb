# frozen_string_literal: true

require "json"
require "tempfile"
require "open3"

module Exports
  module Upd
    class Exporter
      def name = "Universal Portable Dataset"
      def description = "Export to UPD file."
      def options = Verse::Schema.empty

      def export(context)
        file_path = "/tmp/idah-export-#{Time.now.to_i}.upd"

        # Init UPD file
        system("updcli-static", "--input", file_path, "init", exception: true)

        # Keep references to media tempfiles so they are not garbage collected
        # before updcli-static reads them during the append call.
        media_tempfiles = []

        # Stream JSONL lines directly to updcli-static's stdin
        # (no -i flag means it reads from /dev/stdin)
        Open3.popen3("updcli-static", "--input", file_path, "append") do |stdin, stdout, stderr, wait_thr|
          # Drain stdout/stderr in background threads to avoid pipe-buffer deadlocks
          # when updcli-static writes a lot of progress/error output.
          stdout_reader = Thread.new { stdout.read }
          stderr_reader = Thread.new { stderr.read }

          begin
            context.datasets.each do |dataset|
              stdin.puts(build_dataset_jsonl(dataset))

              dataset.entries.each do |entry|
                include_medias = context.options[:include_medias]

                stdin.puts(build_entry_jsonl(dataset.record.id, entry, include_medias))

                entry.annotations.each do |annotation|
                  stdin.puts(build_annotation_jsonl(entry.record.id, annotation))
                end

                medias =
                  case include_medias
                  when "original"
                    entry.medias({ key: "" })
                  when "all"
                    entry.medias
                  else
                    []
                  end

                medias.each do |media|
                  tempfile = download_media(media)
                  media_tempfiles << tempfile
                  stdin.puts(build_media_jsonl(media, tempfile.path))
                end
              end
            end
          ensure
            stdin.close
          end

          exit_status = wait_thr.value
          err_output = stderr_reader.value
          stdout_reader.value

          unless exit_status.success?
            raise "updcli-static append failed: #{err_output}"
          end
        ensure
          # Clean up media tempfiles
          media_tempfiles.each(&:close!)
        end

        context.io.file = File.open(file_path)
      end

      private

      def capitalized_dashed_keys(hash)
        hash.transform_keys do |key|
          key.to_s.split("_").map(&:capitalize).join("-")
        end
      end

      def build_dataset_jsonl(dataset)
        metadata = capitalized_dashed_keys(
          dataset.record.data[:attributes].slice(
            :labeling_configuration,
            :workflow_configuration,
            :labels,
            :status,
            :progress,
            :entries_total_count,
            :entries_completed_count,
            :entries_in_progress_count,
            :created_at,
            :updated_at
          )
        )

        {
          command: "dataset:create",
          args: {
            id: dataset.record.id,
            name: dataset.record.name,
            modality: dataset.record.modality,
            metadata: metadata.to_json
          }
        }.to_json
      end

      def build_entry_jsonl(dataset_id, entry, include_medias)
        media_url =
          if ["original", "all"].include?(include_medias)
            "local:#{entry.record.resource}"
          else
            URI.join(
              ENV.fetch("IDAH_URL"),
              "api/v1/media/medias/files/#{entry.record.resource}"
            )
          end

        metadata = capitalized_dashed_keys(
          entry.record.data[:attributes].slice(
            :name,
            :priority,
            :wf_step,
            :status,
            :resource,
            :assigned_to_id,
            :submitted_by_id,
            :reviewed_by_id,
            :created_at,
            :updated_at
          )
        )

        # Fetch original media metadata to get original width and height
        original_media = entry.medias({ key: "" }).first
        if original_media
          media_meta = original_media.record.data[:attributes][:meta] || {}
          normalized_meta = capitalized_dashed_keys(media_meta)
          normalized_meta.each { |meta_key, meta_value| metadata[meta_key] = meta_value }
        end

        {
          command: "entry:create",
          args: {
            id: entry.record.id,
            dataset_id: dataset_id,
            url: media_url.to_s,
            metadata: metadata.to_json
          }
        }.to_json
      end

      def build_annotation_jsonl(entry_id, annotation)
        attributes = annotation.record.data[:attributes]
        metadata = attributes[:metadata] || {}
        dimensions = annotation.record.dimensions
        type = dimensions.delete(:type)

        metadata = capitalized_dashed_keys(metadata).merge(
          {
            "Created-By" => attributes[:created_by_email],
            "Created-At" => attributes[:created_at],
            "Updated-At" => attributes[:updated_at]
          }
        )

        {
          command: "annotation:create",
          args: {
            id: annotation.record.id,
            entry_id: entry_id,
            type: type,
            shape: dimensions.to_json,
            annotation: annotation.record.annotation.to_json,
            metadata: metadata.to_json
          }
        }.to_json
      end

      def download_media(media)
        filename = media.record.filename
        extension = File.extname(filename)
        base_name = File.basename(filename, extension)
        bin_data = media.download

        tempfile = Tempfile.new([base_name, extension])
        tempfile.binmode
        tempfile.write(bin_data)
        tempfile.rewind
        tempfile
      end

      def build_media_jsonl(media, file_path)
        {
          command: "media:create",
          args: {
            id: media.record.resource,
            file: file_path,
            key: media.record.key,
            mimetype: media.record.mime_type
          }
        }.to_json
      end
    end
  end
end
