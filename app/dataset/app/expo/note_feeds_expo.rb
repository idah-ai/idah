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
                      :created_by_email__eq,
                      :anchor_type__eq,
                      :status__eq,
                      :status__in,
                      :created_at__gte,
                      :created_at__lte,
                      :updated_at__gte,
                      :updated_at__lte
    end

    update
    delete
  end

  expose on_http(:post, "", auth: nil) do
    desc <<-MD
      Create a new note feed
      This endpoint creates a new note feed for an entry.
      When anchor_type is "annotation", annotation_id is required.
    MD
    input do
      field :data, Hash do
        field(:type, String).rule("type invalid") { |x| x == Resource::Dataset::NoteFeeds }
        field(:attributes, NoteFeed::ArgumentsSchema).meta(
          description: "The arguments for creating a note feed. See the schema for details."
        )
      end
    end
  end
  def create
    server.response.status = 201

    service.create_from_params(params.dig(:data, :attributes))
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
