# frozen_string_literal: true

module Exports
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
    def create(project_id, dataset_ids, exporter, options = {}, entry_ids: nil)
      # Ensure that the exporter class is valid
      sanitize_export_class!(exporter)

      # Validate the exporter's own options and fill in their defaults
      options = Exports::Options.validate!(exporter_options_schema(exporter), options)

      # Filter the dataset IDs based on the user's rights and the project they belong to
      dataset_ids = filter_dataset_ids_by_rights(project_id, dataset_ids)

      if dataset_ids.empty?
        raise Verse::Error::Authorization,
              "You do not have access to any of the datasets provided"
      end

      # Entries must belong to the datasets being exported — failing fast
      # avoids generating an export that silently skips (or misses) entries.
      entry_ids = filter_entry_ids_by_rights(dataset_ids, entry_ids)

      exports.transaction do
        arguments = {
          exporter:, # Exporter class
          dataset_ids:,
          options:
        }
        arguments[:entry_ids] = entry_ids if entry_ids&.any?

        job = jobs.create(
          "Exports::Job",
          arguments:
        )

        export_id = exports.create(
          {
            job_id: job.id,
            project_id:,
            created_by_id: auth_context.metadata[:id]
          }
        )

        exports.find!(export_id, included: [:job])
      end
    end

    # Upload the exported file to the export record, under `filename`, or the
    # file's own name.
    def upload(id, file, filename: nil)
      export = exports.find!(id)
      filename ||= File.basename(file.path)

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

    protected

    # Unknown classes are refused by sanitize_export_class! first.
    def exporter_options_schema(exporter)
      klass = Exports::Registry.export_class(exporter)
      klass ? Exports::Registry.options_schema(klass) : Verse::Schema.empty
    end

    def sanitize_export_class!(export)
      return if Exports::Registry.valid_export_class?(export)

      raise Verse::Error::Authorization,
            "invalid export format: `#{export}`"
    end

    def filter_dataset_ids_by_rights(project_id, dataset_ids)
      # Get the list of dataset ids that the user has access to
      accessible_dataset_ids =
        auth_context.can!(:read, Resource::Sync::Exports) do |scope|
          scope.all? { dataset_ids }
          scope.as_org_owner? {
            org_ids = auth_context.custom_scopes[:org]

            # Ensure that the project belongs to the organization the user has access to
            project_ids = Api[:idah].dataset.projects.index_all(
              filter: { id: project_id, organization_id: org_ids },
              fields: { "dataset:projects": ["id"] }
            ).map(&:id)

            if project_ids.empty?
              raise Verse::Error::Authorization,
                    "You do not have access to the project provided"
            end

            # Ensure that datasets belong to the project and organization the user has access to
            Api[:idah].dataset.datasets.index_all(
              filter: { project_id:, id: dataset_ids },
              fields: { "dataset:dataset": ["id"] }
            ).map(&:id)
          }
          scope.as_user? {
            account_id = auth_context.metadata[:id]

            # Ensure that the user is a project owner of the project
            project_ids = Api[:idah].dataset.project_members.index_all(
              filter: { project_id:, account_id:, role: "project_owner", enabled: true },
              fields: { "dataset:project_members": ["project_id"] }
            ).map(&:project_id).uniq

            if project_ids.empty?
              raise Verse::Error::Authorization,
                    "You do not have access to the project provided"
            end

            # Ensure that datasets belong to the projects the user has access to
            project_dataset_ids = Api[:idah].dataset.datasets.index_all(
              filter: { project_id: project_ids, id: dataset_ids },
              fields: { "dataset:dataset": ["id"] }
            ).map(&:id)

            if project_dataset_ids.empty?
              raise Verse::Error::Authorization,
                    "Dataset IDs provided do not belong to the project"
            end

            project_dataset_ids
          }
        end

      # Filter the dataset_ids based on the accessible ones
      dataset_ids.select { |id| accessible_dataset_ids.include?(id) }
    end

    # Entries are children of the already-authorized datasets, so dataset-level
    # rights cover them. This only validates that every requested entry_id
    # actually belongs to one of those datasets — a mismatched id would
    # otherwise be silently skipped during export generation.
    def filter_entry_ids_by_rights(dataset_ids, entry_ids)
      return entry_ids if entry_ids.nil? || entry_ids.empty?

      entry_ids = entry_ids.compact.uniq

      # Batch the id filter into chunks
      accessible_entries =
        entry_ids.each_slice(100).flat_map do |slice|
          Api[:idah].dataset.entries.index_all(
            filter: { dataset_id: dataset_ids, id: slice },
            fields: { "dataset:entries": ["id"] }
          ).map(&:id)
        end

      missing = entry_ids - accessible_entries

      if missing.any?
        raise Verse::Error::ValidationFailed,
              "Some requested entries do not belong to the selected datasets: #{missing.join(", ")}"
      end

      entry_ids
    end
  end
end
