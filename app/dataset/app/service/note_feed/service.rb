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
      note_feeds.delete!(id)
    end

    def resolve(id)
      note_feeds.resolve!(id)
    end

    def create_from_params(data)
      attributes = data.dup

      unless attributes[:entry_id]
        raise Verse::Error::ValidationFailed,
              "entry_id field is required to create a note feed"
      end

      # Organization Owner can find the entry in their scope
      # Project Owner can find the entry in their projects
      # Annotator and Reviewer can find the entry only if assigned to them
      entry = entries.find(attributes[:entry_id], included: ["dataset"])

      unless entry
        raise Verse::Error::ValidationFailed,
              "entry not found to create a note feed"
      end

      # With "as_user" access ensure account can "create" note feed to the project
      if auth_context.can?(:create, note_feeds.class.resource) == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           entry.project_id,
           ["project_owner", "reviewer", "annotator"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create note feed on this project"
      end

      attributes[:id] = UUIDv7.generate
      attributes[:project_id] = entry.project_id
      attributes[:dataset_id] = entry.dataset_id
      attributes[:created_by_email] = auth_context.metadata[:email]
      attributes[:status] = "pending"

      # Check if the current workflow step allows note feeds
      entry_workflow = entry.dataset.entry_workflow.new(entry)

      unless entry_workflow.allowed_note_feed? && entry.status == "in_progress"
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
