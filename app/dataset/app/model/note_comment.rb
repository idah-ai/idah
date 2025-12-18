# frozen_string_literal: true

module NoteComment
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::NoteComments

    field :id, type: String, primary: true
    field :note_feed_id, type: String

    field :content_md, type: String
    field :created_by_email, type: String, readonly: true

    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true
    field :edited_at, type: Time

    belongs_to :note_feed, repository: "NoteFeed::Repository", foreign_key: :note_feed_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "note_comments"
    self.resource = Resource::Dataset::NoteComments

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.as_org_owner? { org_owner_project_scoped_query(action) }
        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    def org_owner_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      org_ids = auth_context.custom_scopes[:org]
      email = auth_context.metadata[:email]

      case action
      when :read
        table.where(
          table.db[:note_feeds].where(
            table.db[:projects]
              .where(organization_id: org_ids)
              .where(id: Sequel[:note_feeds][:project_id])
              .select(1).exists
          ).where(id: Sequel[:note_comments][:note_feed_id]).select(1).exists
        )
      when :update, :delete
        table.where(created_by_email: email)
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end

    # Actions                      Member Roles
    # read, create                | project_owner, reviewer, annotator
    # update(own), delete(own)    | project_owner, reviewer, annotator
    # resolve                     | project_owner, reviewer
    #
    # Info:
    # 1. project_owner can read/create note feeds in their projects
    # 2. reviewer and annotator can read/create note feeds in their assigned entries in their projects
    # 2. all roles can update and delete only their own note feeds in their projects
    # 3. project_owner and reviewer(assigned entries) can resolve note feeds in their projects
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]
      email = auth_context.metadata[:email]

      case action
      when :read
        scoped_fragment = <<-SQL
          EXISTS (
            SELECT 1
            FROM note_feeds nf
            WHERE nf.id = note_comments.note_feed_id
              AND EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.account_id = :account_id
                  AND pm.project_id = nf.project_id
                  AND (
                    -- All with roles
                    pm.role IN :with_roles OR
                    (
                      -- From assigned entries with roles
                      pm.role IN :assigned_to_roles
                      AND EXISTS (
                        SELECT 1
                        FROM entries e
                        WHERE e.id = nf.entry_id
                          AND e.assigned_to_id = :account_id
                      )
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
            assigned_to_roles: %w[reviewer annotator]
          )
        )
      when :update, :delete
        scoped_fragment = <<-SQL
          note_comments.created_by_email = :email AND
          EXISTS (
            SELECT 1
            FROM note_feeds nf
            WHERE nf.id = note_comments.note_feed_id
              AND EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.account_id = :account_id
                  AND pm.project_id = nf.project_id
                  AND (
                    pm.role IN :with_roles OR
                    (
                      pm.role IN :assigned_to_roles
                      AND EXISTS (
                        SELECT 1
                        FROM entries e
                        WHERE e.id = nf.entry_id
                          AND e.assigned_to_id = :account_id
                      )
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
            assigned_to_roles: %w[reviewer annotator]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end
  end
end
