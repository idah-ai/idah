# frozen_string_literal: true

module NoteComment
  class Service < Verse::Service::Base
    use note_comments: NoteComment::Repository, note_feeds: NoteFeed::Repository
    use_system entries: Entry::Repository,
               entry_time_slots: EntryTimeSlot::Repository,
               entry_work_times: EntryWorkTime::Repository

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
      validate_content!(record.attributes[:content_md])

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

      # With "as_user" access ensure account can "create" note feed to the project
      if auth_context.can?(:create, note_comments.class.resource) == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           note_feed.project_id,
           ["project_owner", "reviewer", "annotator"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create comment on this project"
      end

      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:note_feed_id] = note_feed.id
      attributes[:created_by_email] = auth_context.metadata[:email]

      note_comments.transaction do
        id = note_comments.create(attributes)
        comment = note_comments.find!(id)
        touch_entry(note_feed.entry_id)
        comment
      end
    end

    def update(record)
      attributes = record.attributes
      validate_content!(attributes[:content_md]) if attributes.key?(:content_md)
      attributes[:edited_at] = Time.now

      comment = note_comments.find!(record.id)
      note_comments.update!(record.id, attributes)
      touch_entry(entry_id_for(comment.note_feed_id))
      note_comments.find!(record.id)
    end

    def delete(id)
      comment = note_comments.find!(id)
      entry_id = entry_id_for(comment.note_feed_id)
      note_comments.delete!(id)
      touch_entry(entry_id)
    end

    private

    def touch_entry(entry_id)
      TimeTracking.safe_touch(
        entry_repo: entries,
        slot_repo: entry_time_slots,
        work_repo: entry_work_times,
        entry_id: entry_id,
        account_id: auth_context.metadata[:id],
        email: auth_context.metadata[:email]
      )
    end

    def entry_id_for(note_feed_id)
      note_feeds.find!(note_feed_id).entry_id
    end

    private

    def validate_content!(content)
      return if content.is_a?(String) && !content.strip.empty?

      raise Verse::Error::ValidationFailed, "comment content is required"
    end
  end
end
