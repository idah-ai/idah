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
    field :dataset_id, type: Integer
    field :entry_id, type: Integer

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

        scope.as_org_owner? { table.where(project_id: fetch_project_from_orgs) }


        # WIP: this should be changed, tbc
        scope.as_user? {
          table.where(
            project_id: fetch_project_from_memberships
                          .select { |m| m.role == "project_owner"}
                          .map(&:project_id)
          )
        }
      end
    end

    # WIP: this should be changed, tbc
    query
    def membership_project_scoped_query(action)
      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = datasets.project_id
            AND pm.role IN :roles
        )
      SQL

      case action
      when :read
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner reviewer annotator]
          )
        )
      when :create
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    privates

    def fetch_project_from_orgs
      org_ids = auth_context.custom_scopes[:org]

      Verse::Cache.with_cache(
        "media/medias/service/projects",
        "account_id:#{auth_context.metadata[:id]}",
        expires_in: 180
      ) do
        Api[:idah].dataset.projects.index(organization_id: org_ids).data.map(&:id).uniq
      end
    end

    def fetch_project_from_memberships
      account_id = auth_context.metadata[:id]

      Verse::Cache.with_cache(
        "media/medias/service/memberships",
        "account_id:#{account_id}",
        expires_in: 180
      ) do
        Api[:idah].dataset.project_members.index(filter: {account_id: }).data.map(&:project_id).uniq
        members.select { |m| m.role == "project_owner"}.map(&:project_id)
      end
    end
  end
end
