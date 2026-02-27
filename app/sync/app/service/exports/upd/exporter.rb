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
          system(
            "bin/updcli-static --input #{file_path} " \
            "dataset create --id \"#{dataset.dataset.id}\" "\
            "--name \"#{dataset.dataset.name}\" "\
            "--modality #{dataset.dataset.modality}",
            exception: true
          )

          dataset.entries.each do |entry|
            entry_url = "https://idah.ingedata.ai/api/v1/media/medias/files/#{entry.entry.resource}"

            system(
              "bin/updcli-static --input #{file_path} " \
              "entry create --id \"#{entry.entry.id}\" "\
              "--dataset_id \"#{dataset.dataset.id}\" "\
              "--url \"#{entry_url}\" ",
              exception: true
            )

            entry.annotations.each do |annotation|
              dimensions = annotation.annotation.dimensions
              type = dimensions.delete(:type)

              system(
                "bin/updcli-static --input #{file_path} " \
                "annotation create --id \"#{annotation.annotation.id}\" "\
                "--entry_id \"#{entry.entry.id}\" "\
                "--type \"#{type}\" "\
                "--shape '#{dimensions.to_json}' "\
                "--annotation '#{annotation.annotation.annotation.to_json}'",
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
