# frozen_string_literal: true

module NoteComment
  class Service < Verse::Service::Base
    use note_comments: NoteComment::Repository, note_feeds: NoteFeed::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      note_comments.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      note_comments.find!(id, included: included)
    end

    def create(record)
      unless record.note_feed
        raise Verse::Error::ValidationFailed,
              "note feed relationship is required to create a comment"
      end

      # Organization Owner can find the note feed in their scope
      # Project Owner can find the note feed in their projects
      # Annotator and Reviewer can find the note feed only if entry is assigned to them
      note_feed = note_feeds.find(record.note_feed.id)

      unless note_feed
        raise Verse::Error::ValidationFailed,
              "note feed not found to create a comment"
      end

      # Creating a comment requires effective rank >= project_owner, or an
      # annotator/reviewer membership on the note feed's project.
      ensure_note_comment_create_access!(note_feed.project_id)

      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:note_feed_id] = note_feed.id
      attributes[:created_by_email] = auth_context.metadata[:email]

      note_comments.transaction do
        id = note_comments.create(attributes)
        note_comments.find!(id)
      end
    end

    def update(record)
      attributes = record.attributes
      attributes[:edited_at] = Time.now

      note_comments.update!(record.id, attributes)
      note_comments.find!(record.id)
    end

    def delete(id)
      note_comments.delete!(id)
    end

    private

    # Creating a comment requires effective rank >= project_owner, or an
    # annotator/reviewer membership on the note feed's project.
    def ensure_note_comment_create_access!(project_id)
      access = ProjectAccess::Service.resolve(
        auth_context, project_id, action: :create, resource: note_comments.class.resource
      )
      return if %i[all org_owner].include?(access)

      return if %i[project_owner annotator reviewer].include?(access)

      raise Verse::Error::Unauthorized,
            "You do not have permission to create comment on this project"
    end
  end
end
