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
          metadata = dataset.dataset.data[:attributes].slice(
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

          system(
            "bin/updcli-static --input #{file_path} " \
            "dataset create --id \"#{dataset.dataset.id}\" "\
            "--name \"#{dataset.dataset.name}\" "\
            "--modality #{dataset.dataset.modality} "\
            "--metadata '#{metadata.to_json}'",
            exception: true
          )

          dataset.entries.each do |entry|
            entry_url = URI.join(
              ENV.fetch("IDAH_URL"),
              "api/v1/media/medias/files/",
              entry.entry.resource
            )

            metadata = entry.entry.data[:attributes].slice(
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

            system(
              "bin/updcli-static --input #{file_path} " \
              "entry create --id \"#{entry.entry.id}\" "\
              "--dataset_id \"#{dataset.dataset.id}\" "\
              "--url \"#{entry_url}\" "\
              "--metadata '#{metadata.to_json}'",
              exception: true
            )

            entry.annotations.each do |annotation|
              dimensions = annotation.annotation.dimensions
              type = dimensions.delete(:type)

              metadata = annotation.annotation.data[:attributes].slice(
                :created_by_email,
                :metadata,
                :created_at,
                :updated_at
              )

              system(
                "bin/updcli-static --input #{file_path} " \
                "annotation create --id \"#{annotation.annotation.id}\" "\
                "--entry_id \"#{entry.entry.id}\" "\
                "--type \"#{type}\" "\
                "--shape '#{dimensions.to_json}' "\
                "--annotation '#{annotation.annotation.annotation.to_json}' "\
                "--metadata '#{metadata.to_json}'",
                exception: true
              )
            end
          end
        end

        context.io.file = File.open(file_path)
      end
    end
  end
end
