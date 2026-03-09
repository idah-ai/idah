# frozen_string_literal: true

module Exports
  module Upd
    class Exporter
      def name = "Universal Portable Dataset"
      def description = "Export to UPD file."
      def options = Verse::Schema.empty

      def export(context)
        file_path = "/tmp/idah-export-#{Time.now.to_i}.upd"

        # Init UPD file
        system("bin/updcli-static --input #{file_path} init", exception: true)

        context.datasets.each do |dataset|
          append_dataset(file_path, dataset)

          dataset.entries.each do |entry|
            append_entry(file_path, dataset.dataset.id, entry)

            entry.annotations.each do |annotation|
              append_annotation(file_path, entry.entry.id, annotation)
            end

            medias =
              case context.options[:include_medias]
              when "original" # Only include original media (key: "")
                entry.medias({ key: "" })
              when "all" # Include original and processed medias
                entry.medias
              else # Do not include any media
                []
              end

            medias.each do |media|
              append_media(file_path, media)
            end
          end
        end

        context.io.file = File.open(file_path)
      end

      private

      def capitalized_dashed_keys(hash)
        hash.transform_keys do |key|
          key.to_s.split("_").map(&:capitalize).join("-")
        end
      end

      def append_dataset(file_path, dataset)
        metadata = capitalized_dashed_keys(
          dataset.dataset.data[:attributes].slice(
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

        # Create dataset in UPD
        system(
          "bin/updcli-static --input #{file_path} " \
          "dataset create --id \"#{dataset.dataset.id}\" "\
          "--name \"#{dataset.dataset.name}\" "\
          "--modality #{dataset.dataset.modality} "\
          "--metadata '#{metadata.to_json}'",
          exception: true
        )
      end

      def append_entry(file_path, dataset_id, entry)
        media_url = URI.join(
          ENV.fetch("IDAH_URL"),
          "api/v1/media/medias/files/#{entry.entry.resource}"
        )

        metadata = capitalized_dashed_keys(
          entry.entry.data[:attributes].slice(
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

        # Create entry in UPD
        system(
          "bin/updcli-static --input #{file_path} " \
          "entry create --id \"#{entry.entry.id}\" "\
          "--dataset_id \"#{dataset_id}\" "\
          "--url \"#{media_url}\" "\
          "--metadata '#{metadata.to_json}'",
          exception: true
        )
      end

      def append_annotation(file_path, entry_id, annotation)
        attributes = annotation.annotation.data[:attributes]
        metadata = attributes[:metadata] || {}
        dimensions = annotation.annotation.dimensions
        type = dimensions.delete(:type)

        metadata = capitalized_dashed_keys(metadata).merge(
          {
            "Created-By" => attributes[:created_by_email],
            "Created-At" => attributes[:created_at],
            "Updated-At" => attributes[:updated_at]
          }
        )

        # Create annotation in UPD
        system(
          "bin/updcli-static --input #{file_path} " \
          "annotation create --id \"#{annotation.annotation.id}\" "\
          "--entry_id \"#{entry_id}\" "\
          "--type \"#{type}\" "\
          "--shape '#{dimensions.to_json}' "\
          "--annotation '#{annotation.annotation.annotation.to_json}' "\
          "--metadata '#{metadata.to_json}'",
          exception: true
        )
      end

      def append_media(file_path, media)
        filename = media.media.filename
        extension = File.extname(filename)

        base_name = File.basename(filename, extension)
        bin_data = media.download

        tempfile = Tempfile.new([base_name, extension])
        tempfile.binmode
        tempfile.write(bin_data)
        tempfile.rewind

        # Create media in UPD
        system(
          "bin/updcli-static --input #{file_path} " \
          "media create --id \"#{media.media.id}\" "\
          "--file \"#{tempfile.path}\" "\
          "--key \"#{media.media.key}\" "\
          "--mimetype \"#{media.media.mime_type}\"",
          exception: true
        )
      end
    end
  end
end
