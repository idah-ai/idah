# frozen_string_literal: true
module Jobs
  class ExportJob < Base
    def run_impl
      options, dataset_ids = arguments.values_at(:options, :dataset_ids)
      export_class = arguments.dig(:class)

      export_context = Export::Context.new(
        job, dataset_ids, options
      )

      export_class = Verse::Util::Reflection.constantize(
        export_class
      )

      export_class.new.export(
        export_context
      )
    end
  end
end
