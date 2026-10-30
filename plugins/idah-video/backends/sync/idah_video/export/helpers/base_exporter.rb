# frozen_string_literal: true

module IdahVideo
  module Export
    module Helpers
      # What every video export does: go through the datasets one by one, refuse
      # those of another modality, apply the "Completed Entries Only" option,
      # and write export_report.json at the end. A subclass writes one dataset
      # in `export_dataset`.
      class BaseExporter
        MODALITY = "idah-video"

        # `include_medias` values that export frame images. The processed media
        # of "all" (streaming variants, thumbnails) have no place in an export
        # of frames.
        IMAGE_MEDIA_OPTIONS = %w[original all].freeze

        # The format's name, as in the export dialog.
        def name = raise(NotImplementedError)

        def options = Verse::Schema.empty

        def export(context)
          @directory = context.io.directory
          @with_images = IMAGE_MEDIA_OPTIONS.include?(context.options[:include_medias].to_s)
          @report = Report.new(format: name, options: context.options.to_h.transform_keys(&:to_sym))
          @dataset_stems = Set.new

          context.datasets.each do |dataset|
            check_modality!(dataset)
            export_dataset(dataset, entries_filter(context))
          end

          @report.write(File.join(@directory, "export_report.json"))
        ensure
          cleanup
        end

        private

        # @param dataset [Exports::DatasetContext]
        # @param filter [Hash] the entries filter to pass to `dataset.entries`
        def export_dataset(dataset, filter)
          raise NotImplementedError
        end

        # Releases what an interrupted export holds.
        def cleanup; end

        # The dataset's name in file names, unique in the export.
        def dataset_stem(dataset)
          Names.unique(dataset.record.name, @dataset_stems, "dataset")
        end

        def labeling_configuration(dataset)
          dataset.record.data[:attributes][:labeling_configuration]
        end

        def check_modality!(dataset)
          modality = dataset.record.modality
          return if modality == MODALITY

          raise ArgumentError,
                "#{name} exports #{MODALITY} datasets only; dataset `#{dataset.record.name}` " \
                "(#{dataset.record.id}) is #{modality}."
        end

        # Export all entries unless explicitly requested to export only completed ones.
        def entries_filter(context)
          context.options.fetch(:completed_entries, false) ? { status: "completed" } : {}
        end
      end
    end
  end
end
