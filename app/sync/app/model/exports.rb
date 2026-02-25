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
          project_ids = Api[:idah].dataset.projects.index_all(
            filter: { organization_id: org_ids },
            fields: { "dataset:projects": ["id"] }
          ).map(&:id)

          table.where(project_id: project_ids)
        }
        scope.as_user? { table.where(created_by_id: auth_context.metadata[:id]) }
      end
    end
  end
end
