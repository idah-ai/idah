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
    def create(project_id, dataset_ids, exporter, options = {})
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

      exports.transaction do
        job = jobs.create(
          "Exports::Job",
          arguments: {
            exporter:, # Exporter class
            dataset_ids:,
            options:
          }
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
      auth_context.can!(:read, Resource::Sync::Exports) do |scope|
        scope.all? { dataset_ids }

        scope.as_org_owner? do
          unless sync_project_access?(project_id)
            raise Verse::Error::Authorization,
                  "You do not have access to the project provided"
          end

          project_dataset_ids(project_id, dataset_ids)
        end

        scope.as_user? do
          unless sync_project_access?(project_id)
            raise Verse::Error::Authorization,
                  "You do not have access to the project provided"
          end

          project_dataset_ids(project_id, dataset_ids)
        end
      end
    end

    # Ensure the datasets belong to the project the user has access to.
    def project_dataset_ids(project_id, dataset_ids)
      ids = Api[:idah].dataset.datasets.index_all(
        filter: { project_id:, id: dataset_ids },
        fields: { "dataset:datasets": ["id"] }
      ).map(&:id)

      if ids.empty?
        raise Verse::Error::Authorization,
              "Dataset IDs provided do not belong to the project"
      end

      ids
    end

    # Sync access to a project: the project is in one of the actor's orgs, or the
    # actor is an enabled project_owner member of it (the sync as_user rule). An
    # org_owner who is a reviewer on a foreign project therefore has no sync
    # access there.
    def sync_project_access?(project_id)
      org_ids = auth_context.custom_scopes[:org]
      if org_ids&.any? &&
         ProjectMembership::Lookup.new.project_ids_for_organizations(org_ids).include?(project_id)
        return true
      end

      account_id = auth_context.metadata[:id]
      ProjectMembership::Lookup.new.memberships_for(account_id)
                               .any? { |m| m.role == "project_owner" && m.project_id == project_id }
    end
  end
end
