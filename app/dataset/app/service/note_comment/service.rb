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

      note_feed = note_feeds.find(record.note_feed.id)

      unless note_feed
        raise Verse::Error::ValidationFailed,
              "note feed not found to create a comment"
      end

      # With "as_user" access ensure account can "create" note feed to the project
      access = auth_context.can?(:create, note_comments.class.resource)
      if access == :as_user && !ScopedQuery::Service.with_project_access?(
        auth_context.metadata[:id],
        note_feed.project_id,
        ["project_owner", "reviewer", "annotator"]
      )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create note feed"
      end

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
  end
end
