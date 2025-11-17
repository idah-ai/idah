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

    field :project_id, type: Integer
    # field :dataset_id, type: Integer
    # field :entry_id, type: Integer

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

        scope.as_user? { project_from_memberships_scoped(action) }
      end
    end

    private

    def project_from_orgs_scoped
      org_ids = auth_context.custom_scopes[:org]

      projects = Verse::Cache.with_cache(
        "media/medias/service/projects",
        "account_id:#{auth_context.metadata[:id]}",
        expires_in: 180
      ) do
        Api[:idah].dataset.projects.index(organization_id: org_ids).data
      end

      table.where(project_id: projects.map(&:id).uniq)
    end

    def project_from_memberships_scoped(action)
      account_id = auth_context.metadata[:id]

      case action
      when :read
        roles = %w[project_owner annotator reviewer]
      # TODO: users might be able to create media, e.g. add images to comments, so this might be changed
      when :create
        roles = %w[project_owner]
      else
        raise Verse::Error::Unauthorized, "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end

      memberships = Verse::Cache.with_cache(
        "media/medias/service/memberships",
        "account_id:#{account_id}",
        expires_in: 180
      ) do
        Api[:idah].dataset.project_members.index(filter: { account_id: }).data
      end

      table.where(project_id: memberships.select { |m| roles.include?(m.role) }.map(&:project_id).uniq)
    end

    query
    # TODO: this might be changed if everyone can create media, then changed to based on target resource ?
    def account_can_access_project?(project_id, action)
      project_from_memberships_scoped(action).where(project_id:).limit(1).any?
    end
  end
end
