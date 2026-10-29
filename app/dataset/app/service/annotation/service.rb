# frozen_string_literal: true

module Annotation
  class Service < Verse::Service::Base
    use annotations: Annotation::Repository, entries: Entry::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      result = annotations.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )

      merge_annotation_shapes(result)

      result
    end

    def show(id, included: [])
      record = annotations.find!(id, included: included)

      merge_annotation_shapes([record])

      record
    end

    def create(record)
      # Validate required relationships
      unless record.entry
        raise Verse::Error::ValidationFailed,
              "entry relationship is required to create an annotation"
      end

      # Validate required category — mirror the entry-relationship check above.
      # Do not rely on the plugin UI's gating alone; this is exactly the gap
      # that let historical null rows exist in the first place.
      if record.category.nil? || record.category.to_s.strip.empty?
        raise Verse::Error::ValidationFailed,
              "category is required to create an annotation"
      end

      # Organization Owner can find the entry in their scope
      # Project Owner can find the entry in their projects
      # Annotator and Reviewer can find the entry only if assigned to them
      entry = entries.find(record.entry.id)

      unless entry
        raise Verse::Error::ValidationFailed,
              "entry not found to create an annotation"
      end

      # Prevent modifications on completed entries
      check_entry_not_completed!(entry, :create)

      # With "as_user" ensure account can "create" annotation to the project
      if auth_context.can?(:create, annotations.class.resource) == :as_user &&
         !ScopedQuery::Service.with_project_access?(
           auth_context.metadata[:id],
           entry.project_id,
           ["project_owner", "annotator", "reviewer"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create annotation on this project"
      end

      # Assign attributes
      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = entry.project_id
      attributes[:dataset_id] = entry.dataset_id
      attributes[:entry_id] = entry.id
      attributes[:created_by_email] = auth_context.metadata[:email]

      begin
        annotations.transaction do
          id = annotations.create(attributes)
          annotations.find!(id)
        end
      # Rescue Verse::Error::CannotCreateRecord to catch a retry create from a
      # slow client that may have hung up on the previous response.
      # PS: it only solve for create with no further updates in the same rpc batch
      rescue Verse::Error::CannotCreateRecord => e
        annotation = annotations.find(attributes[:id])
        raise e unless annotation

        annotation_h = annotation.to_h
        sliced_annotation = annotation_h.except(*(annotation_h.keys - attributes.keys))
        raise e unless sliced_annotation == attributes

        annotation
      end
    end

    def update(record)
      annotations.transaction do
        annotation = annotations.find!(record.id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        annotations.update!(record.id, record.attributes)
        annotations.find!(record.id)
      end
    end

    def update_attr(id, attributes)
      annotations.transaction do
        annotation = annotations.find!(id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        annotations.update!(id, attributes)
        annotations.find!(id)
      end
    end

    def delete(id)
      annotations.transaction do
        annotation = annotations.find!(id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :delete)

        # `deleted_at` / `deleted_by_email` are read-only on the record, so the
        # op must allow them. Commit 5 moves this into `soft_delete`.
        annotations.update(
          id,
          {
            deleted_at: Time.now.utc,
            deleted_by_email: auth_context.metadata[:email],
          },
          op: :deleted
        )
        annotations.find!(id) # return the tombstoned record, not nil
      end
    end

    def restore(id)
      annotations.transaction do
        annotation = annotations.find!(id, included: [:entry])
        check_entry_not_completed!(annotation.entry, :update)
        annotations.update(id, { deleted_at: nil, deleted_by_email: nil }, op: :restored)
        record = annotations.find!(id)
        merge_annotation_shapes([record])
        record
      end
    end

    # ─── Shape child-record operations ───────────────────────────────────

    #
    # Write (upsert) or delete annotation_shape rows. Key/value validation now
    # lives in the repository, which also owns the SQL. The service keeps the
    # permission and entry-completion guards, enforced uniformly regardless of
    # direction (write or delete).
    #
    def write_shape(annotation_id, key, value)
      annotations.transaction do
        annotation = annotations.find!(annotation_id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        # Guard against writing shape tiles to a soft-deleted annotation — a
        # stale client could otherwise resurrect data on a tombstoned annotation
        # via the tile-sync path.
        if annotation.deleted_at
          raise Verse::Error::ValidationFailed,
                "Cannot write shape to a deleted annotation"
        end

        annotations.write_shape(annotation_id, key, value)
      end
    end

    private

    def merge_annotation_shapes(records)
      annotation_ids = records.map(&:id)
      return if annotation_ids.empty?

      rows = nil
      annotations.client do |db|
        rows = db[:annotation_shape]
               .where(annotation_id: annotation_ids)
               .all
      end

      return if rows.empty?

      grouped = rows.group_by { |r| r[:annotation_id] }

      records.each do |record|
        shapes = grouped[record.id]
        next unless shapes

        shapes.each do |shape|
          # Convert DB row to plain Ruby types:
          # - key is a symbol from Sequel, convert to string
          # - value is a Sequel::Postgres::JSONBHash (Delegator wrapping Hash),
          #   convert to plain Hash via .to_h (which unwraps Delegator)
          key = shape[:key].to_s
          val = shape[:value].respond_to?(:to_h) ? shape[:value].to_h : shape[:value]

          record.shape_args[key] = val
        end
      end
    end

    def check_entry_not_completed!(entry, operation)
      return unless entry&.status == "completed"

      raise Verse::Error::ValidationFailed,
            "Cannot #{operation} annotations on a completed entry"
    end
  end
end
