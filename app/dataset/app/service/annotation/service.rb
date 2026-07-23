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

      annotations.transaction do
        id = annotations.create(attributes)
        annotations.find!(id)
      end
    end

    def update(record)
      annotations.transaction do
        annotation = annotations.find!(record.id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        # Strip any keys from dimensions that exist in annotation_shape
        # (guards against tile keys being persisted into the parent
        #  annotations.dimensions jsonb column)
        attrs = record.attributes
        if attrs[:dimensions].is_a?(Hash)
          annotations.client do |db|
            shape_keys = db[:annotation_shape]
                         .where(annotation_id: record.id)
                         .select_map(:key)
                         .map(&:to_s)
            unless shape_keys.empty?
              attrs[:dimensions] = attrs[:dimensions].reject { |k, _| shape_keys.include?(k.to_s) }
            end
          end
        end

        annotations.update!(record.id, attrs)
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

        annotations.delete!(id)
      end
    end

    # ─── Shape child-record operations ───────────────────────────────────

    #
    # Write (upsert) or delete a single annotation_shape row.
    #
    # +value+ must be a Hash (upsert) or nil (delete).  A null value is
    # idempotent — deleting a non-existent key succeeds silently.
    #
    # Permission and entry-completion guards are enforced uniformly
    # regardless of direction (write or delete).
    #
    def write_shape(annotation_id, key, value)
      raise Verse::Error::ValidationFailed, "key is required" if key.nil? || key.empty?

      unless value.nil? || value.is_a?(Hash)
        raise Verse::Error::ValidationFailed,
              "value must be null (to delete) or a Hash (to upsert)"
      end

      annotations.transaction do
        annotation = annotations.find!(annotation_id, included: [:entry])

        check_entry_not_completed!(annotation.entry, :update)

        now = Time.now.utc

        shape_table = nil
        annotations.client { |db| shape_table = db.from(:annotation_shape) }

        if value.nil?
          # Idempotent delete: succeeds even if the row doesn't exist.
          shape_table.where(annotation_id:, key:).delete
        else
          shape_table
            .insert_conflict(
              target: %i[annotation_id key],
              update: { value: ::Sequel.lit("EXCLUDED.value") }
            )
            .insert(annotation_id:, key:, value: ::Sequel.pg_jsonb(value))
        end

        # Touch the parent annotation's updated_at so the IDB sync mechanism
        # (which uses updated_at__gt) picks up shape changes on reconnect.
        annotations.client do |db|
          db[:annotations]
            .where(id: annotation_id)
            .update(updated_at: now)
        end
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

          record.dimensions[key] = val
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
