# frozen_string_literal: true

module Dataset
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Datasets

    field :id, type: String, primary: true
    field :name, type: String

    field :labels, type: Array

    field :modality, type: String, readonly: true

    field :labeling_configuration, type: Hash
    field :workflow_configuration, type: Hash

    field :status, type: String, readonly: true
    field :progress, type: Float, readonly: true

    field :project_id, type: Integer, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    has_many :entries, repository: "Entry::Repository", foreign_key: :dataset_id

    def entry_workflow
      Workflow::EntryWorkflow
    end
  end

  class Repository < Verse::Sequel::Repository
    self.table = "datasets"
    self.resource = Resource::Dataset::Datasets

    encoder :labeling_configuration, Verse::Sequel::JsonEncoder
    encoder :workflow_configuration, Verse::Sequel::JsonEncoder
    encoder :labels, Verse::Sequel::PgArrayEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # Actions                | Roles
    # read                   | project_owner, annotator, reviewer
    # create, update, delete | project_owner
    #
    # Info:
    # Only project_owner(member), org_owner and admin roles can create, update and delete datasets
    # Annotators and reviewers can only read datasets
    query
    def user_project_scoped_query(action)
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
            account_id: auth_context.metadata[:id],
            roles: %w[project_owner annotator reviewer]
          )
        )
      when :create, :update, :delete
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id: auth_context.metadata[:id],
            roles: %w[project_owner]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    query
    def user_has_project_access?(action, project_id)
      user_project_scoped_query(action).where(project_id:).limit(1).any?
    end
  end
end
