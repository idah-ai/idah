# frozen_string_literal: true

module NoteFeed
  class Service < Verse::Service::Base
    use note_feeds: NoteFeed::Repository
    use_system entries: Entry::Repository,
               annotations: Annotation::Repository

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

    def create_from_params(data)
      attr = data.dup
      attr[:id] = UUIDv7.generate
      attr[:created_by_id] = 1
      attr[:status] = "pending"

      entry_id = attr[:entry_id]
      entry = entries.find!(entry_id)

      unless entry.wf_step == "review"
        raise Verse::Error::ValidationFailed,
              "Cannot add note feed to entry not in review step"
      end

      # TODO: check if the user has permission to add note feed to the entry

      if attr[:annotation_id] && attr[:anchor_type] == "annotation"
        annotation_id = attr[:annotation_id]
        annotations.find!(annotation_id)
      else
        attr.delete(:annotation_id)
      end

      id = note_feeds.create(attr)

      note_feeds.find!(id)
    end
  end
end
