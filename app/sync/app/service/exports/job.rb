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
        raise "TODO: Zip and upload directory in S3"
      end
    ensure
      export_context&.io&.cleanup
    end
  end
end
