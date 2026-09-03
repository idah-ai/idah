# frozen_string_literal: true

require "json"
require "tempfile"
require "open3"
require_relative "subprocess_io"

module Exports
  module Upd
    class Exporter
      # Raised internally when updcli-static closes its stdin pipe while we
      # are still streaming commands (usually because it crashed mid-append).
      class StreamClosed < StandardError; end

      def name = "Universal Portable Dataset"
      def description = "Export to UPD file."
      def options = Verse::Schema.empty

      def export(context, on_output: nil)
        file_path = "/tmp/idah-export-#{Time.now.to_i}.upd"

        # Duplicated entries share the same media resource, but medias are
        # unique in a UPD file: keep track of the resources already appended.
        exported_resources = Set.new

        # Keep references to media tempfiles so they are not garbage collected
        # before updcli-static reads them during the append call.
        media_tempfiles = {}

        Open3.popen3("updcli-static", "--input", file_path, "append") do |stdin, stdout, stderr, wait_thr|
          io = SubprocessIO.new(stdin, stdout, stderr, on_output: on_output)

          begin
            # Initialise UPD file via stdin — avoids a separate system("... init") call
            io.write_jsonl(build_init_jsonl)

            context.datasets.each do |dataset|
              io.write_jsonl(build_dataset_jsonl(dataset))

              include_medias = context.options[:include_medias]

              dataset.entries.each do |entry|
                io.write_jsonl(build_entry_jsonl(dataset.record.id, entry, include_medias))

                entry.annotations.each do |annotation|
                  io.write_jsonl(build_annotation_jsonl(entry.record.id, annotation))
                end

                entry_medias(entry, include_medias, exported_resources).each do |media|
                  tempfile = download_media(media)
                  io.write_jsonl(build_media_jsonl(media, tempfile.path))
                  media_tempfiles[tempfile.path] = tempfile

                  # Parse subprocess confirmation lines — each includes
                  # file_path so we can match and close the exact tempfile.
                  write_output = io.read_output_now(filter: "media.create")
                  write_output.each do |line,|
                    next unless line =~ /file_path\s*:\s*(\S+)/

                    f = media_tempfiles.delete($1)
                    f&.close!
                  end
                end
              end
            end
          rescue SubprocessIO::StreamClosed => e
            # updcli-static stopped reading stdin (usually a crash mid-append).
            # Skip further generation; the ensure block drains its output and
            # wait_thr reports the actual exit failure.
            Verse.logger&.warn { "Subprocess communication failed: #{e.message}" }
          ensure
            begin
              stdin.close
            rescue IOError, Errno::EPIPE
              # stdin already closed by the subprocess
            end

            # Read everything the subprocess still emits, as it comes.
            # Drain both streams together via IO.select so neither pipe can
            # fill up while the other is being drained (avoiding deadlock).
            io.read_remaining_output
          end

          exit_status = wait_thr.value

          unless exit_status.success?
            raise "updcli-static append failed: #{io.err_lines.join}"
          end
        ensure
          # Clean up any tempfiles that weren't eagerly removed
          media_tempfiles.each_value(&:close!)
        end

        context.io.file = File.open(file_path)
      end

      private

      def include_medias?(include_medias)
        ["original", "all"].include?(include_medias)
      end

      # Determine which medias to include based on the option:
      # - "original": only include original media (key: "")
      # - "all": include all medias (original and processed)
      # - otherwise: do not include any media
      #
      # Entries can be duplicated and then point to the same media resource.
      # Since a media can only be added once to a UPD file, the medias of a
      # resource are returned only for the first entry using it.
      def entry_medias(entry, include_medias, exported_resources)
        return [] unless include_medias?(include_medias)
        return [] unless exported_resources.add?(entry.record.resource)

        include_medias == "original" ? entry.medias({ key: "" }) : entry.medias
      end

      def capitalized_dashed_keys(hash)
        hash.transform_keys do |key|
          key.to_s.split("_").map(&:capitalize).join("-")
        end
      end

      def build_init_jsonl
        { command: "init", args: {} }.to_json
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
          if include_medias?(include_medias)
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
