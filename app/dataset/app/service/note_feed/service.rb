# frozen_string_literal: true

module NoteFeed
  class Service < Verse::Service::Base
    use note_feeds: NoteFeed::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      note_feeds.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      note_feeds.find!(id, included: included)
    end

    def create(record)
      attr = record.attributes
      attr[:id] = record.id || UUIDv7.generate

      if record.entry
        attr[:entry_id] = record.entry.id
      else
        raise Verse::Error::ValidationFailed,
              "entry is required to create a note feed"
      end

      if record.annotation && record.anchor_type == "annotation"
        attr[:annotation_id] = record.annotation.id
      end

      # put created_by_id to 1 for now, will be replaced with auth context later
      attr[:created_by_id] = 1

      id = note_feeds.create(attr)

      note_feeds.find!(id)
    end

    def update(record)
      note_feeds.update!(record.id, record.attributes)
      note_feeds.find!(record.id)
    end

    def delete(id)
      note_feeds.delete(id)
    end

    def resolve(id)
      note_feeds.update!(id, { status: "resolved" })
      note_feeds.find!(id)
    end
  end
end
