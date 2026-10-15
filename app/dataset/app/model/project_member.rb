# frozen_string_literal: true

module ProjectMember
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::ProjectMembers

    field :id, type: Integer, primary: true
    field :project_id, type: String, readonly: true

    field :account_id, type: Integer, readonly: true
    field :name, type: [String, NilClass]
    field :email, type: String

    field :role, type: String

    field :invited_by_id, type: Integer, readonly: true
    field :disabled_at, type: [Time, NilClass]

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    include ActorEventMetadata

    self.table = "project_members"
    self.resource = Resource::Dataset::ProjectMembers

    custom_filter :organization_id__in do |collection, value|
      where_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM projects p
          WHERE p.organization_id IN ?
            AND p.id = project_members.project_id
        )
      SQL

      collection.where(Sequel.lit(where_fragment, value.map(&:to_i)))
    end

    custom_filter :enabled do |collection, value|
      enabled = value.to_s.downcase == "true"

      if enabled
        collection.where(disabled_at: nil)
      else
        collection.where(Sequel.~(disabled_at: nil))
      end
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          if auth_context.custom_scopes[:project]
            # API-key project scope: no membership union.
            table.where(project_id: auth_context.custom_scopes[:project])
          else
            table.where(org_projects_condition | user_project_scoped_condition(action))
          end
        end

        scope.as_user? { table.where(user_project_scoped_condition(action)) }
      end
    end

    # Actions                      | Roles
    # read                         | project_owner, reviewer, annotator
    # create, update, delete       | project_owner
    #
    # Info:
    # 1. project_owner can create, update and delete project members
    # 2. annotator and reviewer can only read project members in their projects

    def org_projects_condition
      org_ids = auth_context.custom_scopes[:org]
      return Sequel.lit("false") unless org_ids&.any?

      table.db[:projects]
        .where(organization_id: org_ids)
        .where(id: Sequel[:project_members][:project_id])
        .select(1).exists
    end

    query
    def user_project_scoped_condition(action)
      # Ignore create action as it will be handled in service layer
      return Sequel.lit("true") if action == :create

      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = project_members.project_id
            AND pm.disabled_at IS NULL
            AND pm.role IN :roles
        )
      SQL

      case action
      when :read
        Sequel.lit(
          scoped_fragment,
          account_id:,
          roles: %w[project_owner reviewer annotator]
        )
      when :update, :delete
        Sequel.lit(
          scoped_fragment,
          account_id:,
          roles: %w[project_owner]
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    def create(attributes)
      with_metadata do
        add_event_metadata(
          project_id: attributes[:project_id],
          project_member_account_id: attributes[:account_id],
          organization_id: project_organization_id(attributes[:project_id])
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        membership = membership_and_organization(id)

        add_event_metadata(
          project_id: attributes[:project_id] || membership[:project_id],
          project_member_account_id: attributes[:account_id] || membership[:account_id],
          organization_id: membership[:organization_id]
        )

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        membership = membership_and_organization(id)

        add_event_metadata(
          project_id: membership[:project_id],
          project_member_account_id: membership[:account_id],
          organization_id: membership[:organization_id]
        )

        super(id)
      end
    end

    private

    # The organization id of a project, resolved from the projects table so the
    # emitted event metadata can drive cache invalidation without a separate call.
    def project_organization_id(project_id)
      return nil unless project_id

      table.db[:projects].where(id: project_id).get(:organization_id)
    end

    # Loads a membership together with its project's organization_id in a single
    # query, so an update/delete write needs no separate projects lookup for the
    # emitted event metadata.
    def membership_and_organization(id)
      row = table
        .join(:projects, id: Sequel[:project_members][:project_id])
        .select(Sequel[:project_members].*, Sequel[:projects][:organization_id].as(:organization_id))
        .where(Sequel[:project_members][:id] => id)
        .first

      raise Verse::Error::NotFound, "Project member not found: #{id}" if row.nil?

      row
    end

    def add_event_metadata(**opts)
      add_metadata(**opts)
    end
  end
end
