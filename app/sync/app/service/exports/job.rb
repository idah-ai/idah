# frozen_string_literal: true
module Exports
  class Job < Jobs::Base
    def run_impl
      options, dataset_ids = arguments.values_at(:options, :dataset_ids)
      export_class = arguments.dig(:class)

      export_context = Exports::Context.new(
        self, dataset_ids, options
      )

      export_class = Verse::Util::Reflection.constantize(
        export_class
      )

      export_class.new.export(
        export_context
      )

      case export_context.io.mode
      when :file
        raise "TODO: Upload file in S3"
      when :directory
        zip_path = export_context.io.zip_directory
        # TODO: Upload zip_path to S3
        raise "TODO: Upload file in S3"
      end
    ensure
      export_context&.io&.cleanup
    end
  end
end
