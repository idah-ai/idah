# frozen_string_literal: true

module Medias
  class Record < Verse::Model::Record::Base
    type Resource::Media::Medias

    field :id, type: String, primary: true

    field :resource, type: String
    field :key, type: String

    field :filename, type: String

    field :size, type: Integer
    field :mime_type, type: String

    field :created_by, type: Integer
    field :created_role, type: String

    field :public, type: TrueClass

    field :created_at, type: Time
    field :updated_at, type: Time

    def open
      Verse::Plugin[:shrine].with_storage do |storage|
        storage.open(id)
      rescue Shrine::FileNotFound
        raise Verse::Error::NotFound, "File not found"
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "medias"
    self.resource = Resource::Media::Medias

    private def accessible_resources(project_id)
      # TODO: consider caching here ?
      Api[:idah].dataset.entries.accessible_resources(project_id)
    end

    # scope(s) definition
    def scoped(action)
      auth_context.can!(action, Resource::Media::Medias) do |scope|
        scope.all? { table }

        scope.as_user? do
          # TODO: consider if we get project_id from auth_context or somewhere else ?
          project_id = auth_context.metadata[:project_id]
          resources = accessible_resources(project_id)

          table.where(resource: resources)
        end
      end
    end
  end
end
