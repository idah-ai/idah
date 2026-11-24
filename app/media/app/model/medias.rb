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

    field :meta, type: Hash

    field :created_at, type: Time
    field :updated_at, type: Time

    field :project_id, type: String, readonly: true

    # The storage target the file was written to; nil is the default storage.
    field :storage_target_id, type: [String, NilClass], readonly: true

    def open
      StorageRegistry.with_storage(storage_target_id) do |storage|
        storage.open(id)
      rescue Shrine::FileNotFound
        raise Verse::Error::NotFound, "File not found"
      end
    end
  end

  class Repository < Verse::Sequel::Repository
    include ActorEventMetadata

    self.table = "medias"
    self.resource = Resource::Media::Medias

    encoder :meta, Verse::Sequel::JsonEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? { table.where(project_id: org_owner_project_ids) }
        scope.as_user? { table.where(project_id: member_project_ids) }
      end
    end

    # Refuses unless the actor may add media to the project: the same projects
    # `#scoped(:create)` gives them. The project id comes from the client, and the
    # project decides where its files are stored.
    def authorize_project!(project_id)
      # The block returns the allowed projects, never false: Verse rejects a
      # falsy scope result with its own generic error.
      project_ids = auth_context.can!(:create, self.class.resource) do |scope|
        scope.all? { :all }
        scope.as_org_owner? { org_owner_project_ids }
        scope.as_user? { member_project_ids }
      end

      return if project_ids == :all || project_ids.include?(project_id)

      raise Verse::Error::Authorization, "no access to project `#{project_id}`"
    end

    # TODO: background processors also trigger this event and causing error logs on audit as there's no actor id
    # might need to review or suppress on that
    def create(attributes)
      with_metadata do
        add_metadata(
          project_id: attributes[:project_id],
          media_resource: attributes[:resource]
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        media = find!(id)

        add_metadata(
          project_id: media.project_id,
          media_resource: media.resource
        )

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        media = find!(id)

        add_metadata(
          project_id: media.project_id,
          media_resource: media.resource
        )

        super(id)
      end
    end

    private

    # as_org_owner: the API key's project when the key is scoped to one (no
    # membership union), otherwise the org's projects and the projects where the
    # actor is an enabled member.
    def org_owner_project_ids
      if (project_scope = auth_context.custom_scopes[:project])
        return Array(project_scope)
      end

      lookup = ProjectMembership::Lookup.new
      project_ids = lookup.project_ids_for_organizations(auth_context.custom_scopes[:org])
      project_ids += lookup.memberships_for(auth_context.metadata[:id]).map(&:project_id)
      project_ids.uniq
    end

    # as_user: the projects where the actor is an enabled member.
    def member_project_ids
      ProjectMembership::Lookup.new.memberships_for(auth_context.metadata[:id]).map(&:project_id)
    end
  end
end
