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
        system("updcli-static --input #{file_path} init", exception: true)

        context.datasets.each do |dataset|
          append_dataset(file_path, dataset)

          dataset.entries.each do |entry|
            include_medias = context.options[:include_medias]

            append_entry(file_path, dataset.record.id, entry, include_medias)

            entry.annotations.each do |annotation|
              append_annotation(file_path, entry.record.id, annotation)
            end

            # Determine which medias to include based on the option:
            # - "original": only include original media (key: "")
            # - "all": include all medias (original and processed)
            # - otherwise: do not include any media
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

        # Create dataset in UPD
        system(
          "updcli-static --input #{file_path} " \
          "dataset create --id \"#{dataset.record.id}\" "\
          "--name \"#{dataset.record.name}\" "\
          "--modality #{dataset.record.modality} "\
          "--metadata '#{metadata.to_json}'",
          exception: true
        )
      end

      def append_entry(file_path, dataset_id, entry, include_medias)
        # Use local file URL if original media is included,
        # otherwise use external URL of Media service of IDAH
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

        # Create entry in UPD
        system(
          "updcli-static --input #{file_path} " \
          "entry create --id \"#{entry.record.id}\" "\
          "--dataset_id \"#{dataset_id}\" "\
          "--url \"#{media_url}\" "\
          "--metadata '#{metadata.to_json}'",
          exception: true
        )
      end

      def append_annotation(file_path, entry_id, annotation)
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

        # Create annotation in UPD
        system(
          "updcli-static --input #{file_path} " \
          "annotation create --id \"#{annotation.record.id}\" "\
          "--entry_id \"#{entry_id}\" "\
          "--type \"#{type}\" "\
          "--shape '#{dimensions.to_json}' "\
          "--annotation '#{annotation.record.annotation.to_json}' "\
          "--metadata '#{metadata.to_json}'",
          exception: true
        )
      end

      def append_media(file_path, media)
        filename = media.record.filename
        extension = File.extname(filename)

        base_name = File.basename(filename, extension)
        bin_data = media.download

        tempfile = Tempfile.new([base_name, extension])
        tempfile.binmode
        tempfile.write(bin_data)
        tempfile.rewind

        # Create media in UPD
        system(
          "updcli-static --input #{file_path} " \
          "media create --id \"#{media.record.resource}\" "\
          "--file \"#{tempfile.path}\" "\
          "--key \"#{media.record.key}\" "\
          "--mimetype \"#{media.record.mime_type}\"",
          exception: true
        )
      end
    end
  end
end
