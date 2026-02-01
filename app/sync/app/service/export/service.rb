# frozen_string_literal: true

module Export
  class Service < Verse::Service::Base
    use exports: Exports::Repository
    use_system jobs: Jobs::Service

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
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
    def create(dataset_ids, id, exporter)
      # FIXME: sanitize exporter class +
      # dataset_ids based on the rights of this user
      sanitize_export_class! exporter

      exports.transaction do
        job_id = jobs.create(
          {
            job_class: "Export::Job",
            arguments: {
              exporter:, # Exporter class
              dataset_ids:,
            }
          }
        )

        export_id = exports.create(
          {
            job_id:,
            created_by: metadata[:id]
          }
        )

        exports.find!(export_id)
      end
    end

    # Ensure that the class we are trying to invoke is a
    # valid class (at least, it exists in the registry)
    protected def sanitize_export_class!(export)
      return if Export::Registry.is_valid_export_class?(export)

      raise Verse::Error::Authorization,
        "invalid export format: `#{export}`"
    end

  end
end
