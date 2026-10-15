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
    include ActorEventMetadata

    self.table = "exports"
    self.resource = Resource::Sync::Exports

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_org_owner? {
          org_ids = auth_context.custom_scopes[:org]
          project_id_scope = auth_context.custom_scopes[:project]

          project_ids = if org_ids
                          # Org projects ∪ projects where the actor is an enabled
                          # project_owner (the sync as_user rule).
                          org_and_member_project_ids(org_ids)
                        elsif project_id_scope
                          # If the user has a project scope, use that to filter projects.
                          [project_id_scope].flatten
                        else
                          # If no specific scope is provided, return an empty set to prevent access.
                          []
                        end

          table.where(project_id: project_ids)
        }
        scope.as_user? {
          account_id = auth_context.metadata[:id]

          # Get project IDs where the user is a project owner.
          # This ensures that users can access exports for projects they own.
          project_ids = ProjectMembership::Lookup.new.memberships_for(account_id)
            .select { |m| m.role == "project_owner" }
            .map(&:project_id)

          table.where(project_id: project_ids)
        }
      end
    end

    def create(attributes)
      with_metadata do
        add_metadata(project_id: attributes[:project_id])

        super(attributes)
      end
    end

    private

    # Org projects ∪ projects where the actor is an enabled project_owner member
    # (the sync as_user rule). An org_owner who is a reviewer on a foreign
    # project therefore gets no sync access there.
    def org_and_member_project_ids(org_ids)
      account_id = auth_context.metadata[:id]
      lookup = ProjectMembership::Lookup.new

      project_ids = lookup.project_ids_for_organizations(org_ids)
      project_ids += lookup.memberships_for(account_id)
        .select { |m| m.role == "project_owner" }
        .map(&:project_id)

      project_ids.uniq
    end
  end
end
