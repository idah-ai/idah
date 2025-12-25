# frozen_string_literal: true

module Project
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Projects

    field :id, type: String, primary: true

    field :name, type: String
    field :description, type: [String, NilClass]
    field :created_by_email, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    field :organization_id, type: Integer, readonly: true

    has_many :project_members, repository: "ProjectMember::Repository", foreign_key: :project_id
    has_many :datasets, repository: "Dataset::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :project_id
    has_many :annotations, repository: "Annotation::Repository", foreign_key: :project_id
    has_many :note_feeds, repository: "NoteFeed::Repository", foreign_key: :project_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          table.where(organization_id: org_ids)
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions          | Roles
    # read             | project_owner, annotator, reviewer
    # update/delete    | project_owner
    # create           | N/A
    #
    # Info:
    # 1. annotators and reviewers can only read projects assigned to them
    # 2. project_owner(member) can update and delete projects
    # 3. only org_owner and admin roles can create projects
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          -- All with roles
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = projects.id
            AND pm.role IN :roles
        )
      SQL

      case action
      when :read
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            roles: %w[project_owner annotator reviewer]
          )
        )
      when :update, :delete
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

    def create(attributes)
      with_metadata do
        add_metadata(
          actor_account_id: auth_context.metadata[:account_id],
          actor_account_email: auth_context.metadata[:email],
          organization_id: attributes[:organization_id]
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        project = find!(id)

        if project
          add_metadata(
            actor_account_id: auth_context.metadata[:account_id],
            actor_account_email: auth_context.metadata[:email],
            organization_id: attributes[:organization_id] || project.organization_id,
            project_id: id
          )
        end

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        project = find!(id)

        if project
          add_metadata(
            actor_account_id: auth_context.metadata[:account_id],
            actor_account_email: auth_context.metadata[:email],
            organization_id: project.organization_id,
            project_id: id
          )
        end

        super(id)
      end
    end
  end
end
