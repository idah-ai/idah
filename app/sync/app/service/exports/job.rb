# frozen_string_literal: true

module Exports
  class Job < Jobs::Base
    self.max_retries = 3

    def run_impl
      options, dataset_ids = arguments.values_at(:options, :dataset_ids)
      export_class = arguments[:exporter]

      export_context = Exports::Context.new(
        self,
        dataset_ids,
        options
      )

      export_class = Verse::Util::Reflection.constantize(export_class)
      export_class.new.export(export_context)

      import_file =
        case export_context.io.mode
        when :file
          export_context.io.file.rewind
          export_context.io.file
        when :dir
          export_context.io.zip_directory
        else
          raise "Invalid IO mode: #{export_context.io.mode}"
        end

      export = exports.show(arguments[:export_id])
      exports.upload(export.id, import_file)
    ensure
      export_context.io&.cleanup
    end

    private

    def exports
      @exports ||= Exports::Service.new(Verse::Auth::Context.new)
    end
  end
end
