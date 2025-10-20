# frozen_string_literal: true

class NoteCommentsExpo < BaseExpo
  http_path "/note_comments"

  use_service NoteComment::Service

  json_api NoteComment::Record, http_opts: { auth: nil } do
    allowed_included "note_feed"

    show
    index do
      allowed_filters :note_feed_id__eq,
                      :created_by_id__eq,
                      :is_edited__eq,
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
