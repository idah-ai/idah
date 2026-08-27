# frozen_string_literal: true

require "json"
require "tempfile"
require "open3"

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
        media_tempfiles = []

        Open3.popen3("updcli-static", "--input", file_path, "append") do |stdin, stdout, stderr, wait_thr|
          err_lines = []

          begin
            # Initialise UPD file via stdin — avoids a separate system("... init") call
            write_stdin(
              stdin,
              stdout,
              stderr,
              err_lines,
              build_init_jsonl,
              on_output: on_output
            )

            context.datasets.each do |dataset|
              write_stdin(
                stdin,
                stdout,
                stderr,
                err_lines,
                build_dataset_jsonl(dataset),
                on_output: on_output
              )

              dataset.entries.each do |entry|
                include_medias = context.options[:include_medias]

                write_stdin(
                  stdin,
                  stdout,
                  stderr,
                  err_lines,
                  build_entry_jsonl(dataset.record.id, entry, include_medias),
                  on_output: on_output
                )

                entry.annotations.each do |annotation|
                  write_stdin(
                    stdin,
                    stdout,
                    stderr,
                    err_lines,
                    build_annotation_jsonl(entry.record.id, annotation),
                    on_output: on_output
                  )
                end

                entry_medias(entry, include_medias, exported_resources).each do |media|
                  tempfile = download_media(media)
                  media_tempfiles << tempfile
                  write_stdin(
                    stdin,
                    stdout,
                    stderr,
                    err_lines,
                    build_media_jsonl(media, tempfile.path),
                    on_output: on_output
                  )
                end
              end
            end
          rescue StreamClosed
            # updcli-static stopped reading stdin (usually a crash mid-append).
            # Skip further generation; the ensure block drains its output and
            # wait_thr reports the actual exit failure.
          ensure
            begin
              stdin.close
            rescue IOError, Errno::EPIPE
              # stdin already closed by the subprocess
            end

            # Read everything the subprocess still emits, as it comes.
            read_until_eof(stdout, :out, err_lines, on_output: on_output)
            read_until_eof(stderr, :err, err_lines, on_output: on_output)
          end

          exit_status = wait_thr.value

          unless exit_status.success?
            raise "updcli-static append failed: #{err_lines.join}"
          end
        ensure
          # Clean up media tempfiles
          media_tempfiles.each(&:close!)
        end

        context.io.file = File.open(file_path)
      end

      private

      # Write a JSONL command to updcli's stdin, draining whatever output the
      # subprocess already produced (via IO.select) so its pipes never fill
      # up. If updcli closes its stdin (crash), stop generating and let
      # export() surface the underlying failure.
      def write_stdin(stdin, stdout, stderr, err_lines, line, on_output: nil)
        drain_outputs(stdout, stderr, err_lines, on_output: on_output)

        stdin.puts(line)
      rescue Errno::EPIPE, IOError => e
        raise StreamClosed, "updcli-static closed its stdin: #{e.message}"
      ensure
        drain_outputs(stdout, stderr, err_lines, on_output: on_output)
      end

      # Non-blocking drain of whatever stdout/stderr updcli produced so far,
      # using IO.select to keep control of read/write interleaving.
      def drain_outputs(stdout, stderr, err_lines, on_output: nil)
        streams = { stdout => :out, stderr => :err }

        until streams.empty?
          ready = IO.select(streams.keys, nil, nil, 0)
          break unless ready

          ready.first.each do |io|
            loop do
              chunk = io.read_nonblock(4096, exception: false)

              case chunk
              when :wait_readable
                break
              when nil # EOF
                streams.delete(io)
                break
              else
                emit_output(chunk, streams[io], err_lines, on_output: on_output)
              end
            end
          end
        end
      end

      # Blocking read of `io` until EOF (the subprocess exited and closed the
      # pipe), forwarding output as it arrives.
      def read_until_eof(io, stream, err_lines, on_output: nil)
        loop do
          chunk = io.read_nonblock(4096, exception: false)

          case chunk
          when nil # EOF
            break
          when :wait_readable
            break unless IO.select([io], nil, nil, nil)
          else
            emit_output(chunk, stream, err_lines, on_output: on_output)
          end
        end
      end

      # Forward a chunk of updcli output: stderr is kept for the failure
      # message, and every chunk goes to the optional callback (or to the
      # Verse logger by default) as it is read.
      def emit_output(chunk, stream, err_lines, on_output: nil)
        err_lines << chunk if stream == :err

        if on_output
          on_output.call(chunk, stream)
        elsif stream == :out
          Verse.logger&.debug { "updcli: #{chunk}" }
        else
          Verse.logger&.warn { "updcli: #{chunk}" }
        end
      end

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
