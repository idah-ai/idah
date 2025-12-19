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

    field :project_id, type: String, readonly: true

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

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? { project_from_orgs_scoped }

        scope.as_user? { project_from_memberships_scoped }
      end
    end

    private def project_from_orgs_scoped
      org_ids = auth_context.custom_scopes[:org]
      projects = Api[:idah].dataset.projects.index(organization_id: org_ids).data

      table.where(project_id: projects.map(&:id).uniq)
    end

    private def project_from_memberships_scoped
      account_id = auth_context.metadata[:id]
      memberships = Api[:idah].dataset.project_members.index(filter: { account_id: }).data

      table.where(project_id: memberships.map(&:project_id).uniq)
    end

    def create(attributes)
      with_metadata do
        add_metadata(
          email: auth_context.metadata[:email],
          project_id: attributes[:project_id],
        )

        super(attributes)
      end
    end

    def update!(id, attributes)
      with_metadata do
        media = find!(id)

        add_metadata(
          email: auth_context.metadata[:email],
          project_id: media.project_id,
        )

        super(id, attributes)
      end
    end

    def delete!(id)
      with_metadata do
        media = find!(id)

        add_metadata(
          email: auth_context.metadata[:email],
          project_id: media.project_id,
        ) if media

        super(id)
      end
    end
  end
end
