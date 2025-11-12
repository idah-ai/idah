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
      record.attributes[:edited_at] = Time.now

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
      attributes = data.dup

      unless attributes[:entry_id]
        raise Verse::Error::ValidationFailed,
              "entry_id field is required to create a note feed"
      end

      entry = entries.find!(attributes[:entry_id])

      attributes[:id] = UUIDv7.generate
      attributes[:project_id] = entry.project_id
      attributes[:dataset_id] = entry.dataset_id
      # put created_by_email to nil for now, will be replaced with auth_context[:email] later
      attributes[:created_by_email] ||= nil
      attributes[:status] = "pending"

      entry_id = attributes[:entry_id]
      entry = entries.find!(entry_id, included: ["dataset"])

      # Check if the current workflow step allows note feeds
      dataset = entry.dataset
      noteable_steps = dataset.workflow_configuration[:noteable_steps] || []

      unless noteable_steps.include?(entry.wf_step) && entry.status == "in_progress"
        raise Verse::Error::ValidationFailed,
              "Cannot add note feed to entry in current step (#{entry.wf_step})"
      end

      # TODO: check if the user has permission to add note feed to the entry
      if attributes[:annotation_id] && attributes[:anchor_type] == "annotation"
        annotation_id = attributes[:annotation_id]
        annotations.find!(annotation_id)
      else
        attributes.delete(:annotation_id)
      end

      note_feeds.transaction do
        id = note_feeds.create(attributes)
        note_feeds.find!(id)
      end
    end
  end
end
