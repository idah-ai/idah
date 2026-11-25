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
    include ActorEventMetadata

    self.table = "projects"
    self.resource = Resource::Dataset::Projects

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          if auth_context.custom_scopes[:project]
            # API-key project scope: no membership union.
            table.where(id: auth_context.custom_scopes[:project])
          else
            table.where(org_projects_condition | user_project_scoped_condition(action))
          end
        end

        scope.as_user? { table.where(user_project_scoped_condition(action)) }
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

    def org_projects_condition
      org_ids = auth_context.custom_scopes[:org]
      return Sequel.lit("false") unless org_ids&.any?

      Sequel[:organization_id] =~ org_ids
    end

    query
    def user_project_scoped_condition(action)
      return Sequel.lit("true") if action == :create

      account_id = auth_context.metadata[:id]
      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = projects.id
            AND pm.disabled_at IS NULL
            AND pm.role IN :roles
        )
      SQL

      case action
      when :read
        Sequel.lit(
          scoped_fragment,
          account_id:,
          roles: %w[project_owner annotator reviewer]
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
          organization_id: attributes[:organization_id],
          project_id: attributes[:id]
        )

        super(attributes)
      end
    end

    def update!(id, attributes, scope: scoped(:update))
      with_metadata do
        project = find!(id)

        new_org = attributes[:organization_id] || project.organization_id
        metadata = {
          organization_id: new_org,
          project_id: id
        }
        if attributes.key?(:organization_id) && attributes[:organization_id] != project.organization_id
          metadata[:previous_organization_id] = project.organization_id
        end

        add_event_metadata(**metadata)

        super(id, attributes, scope:)
      end
    end

    def delete!(id)
      with_metadata do
        project = find!(id)

        add_event_metadata(
          organization_id: project.organization_id,
          project_id: id
        )

        super(id)
      end
    end

    private

    def add_event_metadata(**opts)
      add_metadata(**opts)
    end
  end
end
