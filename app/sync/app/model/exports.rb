# frozen_string_literal: true

module Exports
  class Record < Verse::Model::Record::Base
    type Resource::Sync::Exports

    field :id, type: String, primary: true
    field :job_id, type: String
    field :project_id, type: String
    field :created_by_id, type: Integer

    field :file_id, type: [String, NilClass]
    field :filename, type: [String, NilClass]
    field :mime_type, type: [String, NilClass]
    field :size, type: Integer

    field :created_at, type: Time

    belongs_to :job, repository: "Jobs::Repository", foreign_key: :job_id

    def open
      Verse::Plugin[:shrine].with_storage do |storage|
        storage.open(file_id)
      rescue Shrine::FileNotFound
        raise Verse::Error::NotFound, "File not found"
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "exports"
    self.resource = Resource::Sync::Exports

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_org_owner? {
          org_ids = auth_context.custom_scopes[:org]
          project_id_scope = auth_context.custom_scopes[:project]

          if org_ids.nil? && project_id_scope.nil?
            raise Verse::Error::Authorization,
                  "Org-owner scope requires either :org or :project custom scope, but neither was set"
          end

          if org_ids
            project_ids = Api[:idah].dataset.projects.index_all(
              filter: { organization_id: org_ids },
              fields: { "dataset:projects": ["id"] }
            ).map(&:id)
            table.where(project_id: project_ids)
          elsif project_id_scope
            table.where(project_id: [project_id_scope].flatten)
          end
        }
        scope.as_user? {
          account_id = auth_context.metadata[:id]

          # Get project IDs where the user is a project owner.
          # This ensures that users can access exports for projects they own.
          project_ids = Api[:idah].dataset.project_members.index_all(
            filter: { account_id:, role: "project_owner", enabled: true },
            fields: { "dataset:project_members": ["project_id"] }
          ).map(&:project_id).uniq

          table.where(project_id: project_ids)
        }
      end
    end

    # Register a rollback hook on the current database transaction.
    # This is a wrapper around Sequel's after_rollback that avoids
    # coupling the service layer to Sequel internals.
    def on_rollback(&block)
      table.db.after_rollback(&block)
    end
  end
end
