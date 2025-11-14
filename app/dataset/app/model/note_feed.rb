# frozen_string_literal: true

module NoteFeed
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::NoteFeeds

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true
    field :dataset_id, type: String, readonly: true
    field :entry_id, type: String, readonly: true
    field :annotation_id, type: String, readonly: true

    field :created_by_email, type: String, readonly: true
    field :anchor_type, type: String
    field :position, type: Hash
    field :status, type: String, readonly: true
    field :content_md, type: String

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
    field :edited_at, type: Time

    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
    belongs_to :annotation, repository: "Annotation::Repository", foreign_key: :annotation_id

    has_many :note_comments, repository: "NoteComment::Repository", foreign_key: :note_feed_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "note_feeds"
    self.resource = Resource::Dataset::NoteFeeds

    encoder :position, Verse::Sequel::JsonEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_user? { account_project_scoped_query(action) }
      end
    end

    # Actions                       | Member Roles
    # read                          | project_owner, annotator, reviewer
    # create, update, delete        | project_owner
    # resolve, delete(own)          | reviewer
    #
    # Info:
    # 1. org_owner, admin roles and project_owner(member) can create, update and delete all note feeds
    # 2. annotator and reviewer can read note feeds which entries are assigned to them
    # 3. reviewer can resolve and delete(own) their note feeds
    query
    def account_project_scoped_query(action)
      account_id = auth_context.metadata[:id]
      email = auth_context.metadata[:email]

      case action
      when :read
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = note_feeds.project_id
              AND (
                pm.role IN :with_roles OR
                (
                  pm.role IN :assigned_to_roles AND
                  EXISTS (
                    SELECT 1
                    FROM entries e
                    WHERE e.id = note_feeds.entry_id
                      AND e.assigned_to_id = :account_id
                  )
                )
              )
          )
        SQL

        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            with_roles: %w[project_owner],
            assigned_to_roles: %w[annotator reviewer]
          )
        )
      when :create
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = note_feeds.project_id
              AND (
                pm.role IN :with_roles OR
                (
                  pm.role IN :assigned_to_roles
                  AND EXISTS (
                    SELECT 1
                    FROM entries e
                    WHERE e.id = note_feeds.entry_id
                      AND e.assigned_to_id = :account_id
                  )
                )
              )
          )
        SQL

        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            with_roles: %w[project_owner],
            assigned_to_roles: %w[reviewer]
          )
        )
      when :update, :delete
        scoped_fragment = <<-SQL
          note_feeds.created_by_email = :email AND
          EXISTS (
            SELECT 1
            FROM project_members pm
            WHERE pm.account_id = :account_id
              AND pm.project_id = note_feeds.project_id
              AND (
                pm.role IN :with_roles OR
                (
                  pm.role IN :assigned_to_roles
                  AND EXISTS (
                    SELECT 1
                    FROM entries e
                    WHERE e.id = note_feeds.entry_id
                      AND e.assigned_to_id = :account_id
                  )
                )
              )
          )
        SQL

        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            email:,
            with_roles: %w[project_owner],
            assigned_to_roles: %w[reviewer]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end
  end
end
