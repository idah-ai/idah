# frozen_string_literal: true
module Jobs
  class Export < Process
    def on_process_complete(process, context)
      File.open(context.io.filename) do |file|
        Exports::Service.new(
          Verse::Auth::Context[:system]
          # auth_context.fetch(:metadata)
        ).create(
          job_id,
          context.io.filename,
          file,
          created_by_organization,
          created_by_metadata,
          created_by_custom_scopes,
        )
      end
      FileUtils.rm_rf(context.io.filename)
    end
  end
end
