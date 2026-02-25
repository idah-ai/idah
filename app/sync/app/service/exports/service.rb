# frozen_string_literal: true

module Exports
  class Service < Verse::Service::Base
    use exports: Exports::Repository
    use_system jobs: Jobs::Service

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      binding.pry
      exports.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      exports.find!(id, included:)
    end

    def delete(id)
      file = exports.find!(id)
      exports.delete(file.id)
    end

    # Create an export object + setup the job with it.
    def create(project_id, dataset_ids, exporter)
      # FIXME: sanitize exporter class +
      # dataset_ids based on the rights of this user
      sanitize_export_class! exporter

      exports.transaction do
        job = jobs.create(
          "Exports::Job",
          arguments: {
            exporter:, # Exporter class
            dataset_ids:,
          }
        )

        export_id = exports.create(
          {
            job_id: job.id,
            project_id:,
            created_by_id: 1 # auth_context.metadata[:id]
          }
        )

        exports.find!(export_id)
      end
    end

    # Upload the exported file to the export record
    def upload(id, file)
      export = exports.find!(id)
      filename = File.basename(file.path)

      Verse::Plugin[:shrine].with_storage do |storage|
        file = storage.upload(file)

        exports.table.db.after_rollback do
          Verse.logger.warn{
            "Rollback called, deleting `#{file.id}` from storage"
          }
          storage.delete(file.id) if file
        end

        exports.update(
          export.id,
          {
            file_id: file.id,
            filename:,
            size: file.size,
            mime_type: file.mime_type
          }
        )
      end

      exports.find!(export.id)
    end

    # Ensure that the class we are trying to invoke is a
    # valid class (at least, it exists in the registry)
    protected def sanitize_export_class!(export)
      return if Exports::Registry.valid_export_class?(export)

      raise Verse::Error::Authorization,
            "invalid export format: `#{export}`"
    end
  end
end
