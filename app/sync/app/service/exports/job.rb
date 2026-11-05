# frozen_string_literal: true

module Exports
  class Job < Jobs::Base
    def run_impl
      options, dataset_ids = arguments.values_at(:options, :dataset_ids)
      entry_ids = arguments[:entry_ids]
      export_class = arguments[:exporter]

      export_context = Exports::Context.new(
        self,
        dataset_ids,
        options,
        entry_ids
      )

      export_class = Verse::Util::Reflection.constantize(export_class)
      exporter = export_class.new
      exporter.export(export_context)

      import_file =
        case export_context.io.mode
        when :file
          export_context.io.file.rewind
          export_context.io.file
        when :dir
          File.open(export_context.io.zip_directory)
        else
          raise "Invalid IO mode: #{export_context.io.mode}"
        end

      export = exports.index({ job_id: }, items_per_page: 1).first
      exports.upload(export.id, import_file, filename: self.class.filename(exporter, import_file.path))
    ensure
      export_context.io&.cleanup
    end

    # The downloaded file's name: `idah-`, the format, then when it was
    # exported, such as `idah-coco-image_2026-10-16_0430.zip`, with the
    # exported file's extension.
    def self.filename(exporter, path, time = Time.now.utc)
      name = exporter.respond_to?(:name) ? exporter.name.to_s : ""
      format = name.downcase.gsub(/[^a-z0-9]+/, "-").delete_prefix("-").delete_suffix("-")
      format = "export" if format.empty?

      "idah-#{format}_#{time.strftime("%Y-%m-%d_%H%M")}#{File.extname(path)}"
    end

    private

    def exports
      @exports ||= Exports::Service.new(Verse::Auth::Context.new)
    end
  end
end
