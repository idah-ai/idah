# frozen_string_literal: true

module NoteComment
  class Service < Verse::Service::Base
    use note_comments: NoteComment::Repository

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
      attr = record.attributes

      attr[:id] = record.id || UUIDv7.generate
      attr[:is_edited] = false

      if record.note_feed
        attr[:note_feed_id] = record.note_feed.id
      else
        raise Verse::Error::ValidationFailed,
              "note_feed is required to create a note comment"
      end

      # put created_by_email to nil for now, will be replaced with auth_context[:email] later
      attr[:created_by_email] ||= nil

      id = note_comments.create(attr)

      note_comments.find!(id)
    end

    def update(record)
      attr = record.attributes
      attr[:is_edited] = true

      note_comments.update!(record.id, attr)
      note_comments.find!(record.id)
    end

    def delete(id)
      note_comments.delete(id)
    end
  end
end
