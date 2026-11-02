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
      current = note_feeds.find!(record.id)
      attributes = record.attributes

      # A note feed must always keep at least one of feedback_keys or content_md
      # (mirrors the ArgumentsSchema rule enforced on the create endpoint).
      unless content_remaining?(current, attributes)
        raise Verse::Error::ValidationFailed,
              "either feedback_keys or content_md must be provided"
      end

      # When feedback keys are modified, they must exist in the dataset's
      # feedback configuration (same rule as the create path).
      if attributes.key?(:feedback_keys)
        entry = entries.find!(current.entry_id, included: ["dataset"])
        validate_feedback_keys!(entry, attributes[:feedback_keys])
      end

      # Only stamp edited_at when the note's content actually changed, so no-op
      # PATCHes do not rewrite the "last edited" timestamp.
      attributes[:edited_at] = Time.now if content_edited?(current, attributes)

      note_feeds.update!(record.id, attributes)
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
      entry_workflow = entry.dataset.entry_workflow.new(entries, entry)

      unless entry_workflow.allowed_note_feed? && entry.status == "in_progress"
        raise Verse::Error::ValidationFailed,
              "Cannot add note feed to entry in current step (#{entry.wf_step})"
      end

      # Validate that all feedback_keys exist in the dataset's feedback configuration
      validate_feedback_keys!(entry, attributes[:feedback_keys])

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

    private

    # The resulting note must keep at least one of feedback_keys or content_md,
    # mirroring the ArgumentsSchema rule enforced on the create endpoint.
    def content_remaining?(current, attributes)
      feedback_keys =
        attributes.key?(:feedback_keys) ? attributes[:feedback_keys] : current.feedback_keys
      content_md =
        attributes.key?(:content_md) ? attributes[:content_md] : current.content_md

      has_feedback_key = feedback_keys.is_a?(Array) && feedback_keys.any?
      has_content_md = !content_md.nil? && !content_md.empty?

      has_feedback_key || has_content_md
    end

    # Validates that every provided feedback key exists in the dataset's
    # feedback configuration. Shared by the create and update paths.
    def validate_feedback_keys!(entry, feedback_keys)
      return unless feedback_keys.is_a?(Array) && feedback_keys.any?

      feedback_config = entry.dataset.feedback_configuration || {}
      missing = feedback_keys.reject { |key| feedback_config.key?(key.to_sym) }

      return if missing.empty?

      raise Verse::Error::ValidationFailed,
            "Feedback keys #{missing.inspect} do not exist in the dataset's feedback configuration"
    end

    # True when one of the editable content fields actually differs from the
    # stored record. Used to avoid bumping edited_at on no-op updates.
    def content_edited?(current, attributes)
      %i[anchor_type position content_md feedback_keys].any? do |field|
        attributes.key?(field) && attributes[field] != current.public_send(field)
      end
    end
  end
end
