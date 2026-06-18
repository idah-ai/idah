# frozen_string_literal: true

class NoteCommentsExpo < BaseExpo
  http_path "/note_comments"

  use_service NoteComment::Service

  desc <<~MD
    Comments provide threaded discussions within note feeds
    for collaborative communication on entries and annotations.
  MD

  json_api NoteComment::Record do
    allowed_included "note_feed"

    show
    index do
      allowed_filters :note_feed_id,
                      :created_by_email__match,
                      :created_at__gte,
                      :created_at__lte,
                      :updated_at__gte,
                      :updated_at__lte
    end

    create do
      authorized_relationships note_feed: [:link]
    end
    update
    delete
  end
end
