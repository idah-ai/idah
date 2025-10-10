# frozen_string_literal: true

class NoteFeedsExpo < BaseExpo
  http_path "/note_feeds"

  use_service NoteFeed::Service

  json_api NoteFeed::Record, http_opts: { auth: nil } do
    allowed_included "entry", "annotation", "note_comments"

    show
    index do
      allowed_filters :entry_id__eq,
                      :annotation_id__eq,
                      :created_by_id__eq,
                      :anchor_type__eq,
                      :status__eq,
                      :status__in,
                      :created_at__gte,
                      :created_at__lte,
                      :updated_at__gte,
                      :updated_at__lte
    end

    create do
      authorized_relationships entry: [:link],
                               annotation: [:link]
    end
    update
    delete
  end

  expose on_http(:post, "/:id/resolve", auth: nil) do
    desc "Resolve a note feed by updating status from pending to resolved"
    input do
      field :id, String
    end
  end
  def resolve
    note_feed_id = params[:id]
    service.resolve(note_feed_id)
  end
end
