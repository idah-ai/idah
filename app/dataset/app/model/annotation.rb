# frozen_string_literal: true

module Annotation
  class Record < Verse::Model::Record::Base
    type Resource::Dataset::Annotations

    field :id, type: String, primary: true
    field :project_id, type: String, readonly: true
    field :dataset_id, type: String, readonly: true
    field :entry_id, type: String, readonly: true

    field :shape_type, type: String
    field :shape_args, type: Hash
    field :category, type: String
    field :properties, type: Hash
    field :metadata, type: Hash

    # Soft-delete fields. Read-only over the API: only `soft_delete`, `restore`
    # and `create` (when duplicating a soft-deleted annotation) set them; they
    # are still returned by the API.
    field :deleted_at, type: Time, readonly: true
    field :deleted_by_email, type: String, readonly: true

    field :version, type: Integer, readonly: true

    field :created_by_email, type: String, readonly: true
    field :created_at, type: Time, readonly: true
    field :updated_at, type: Time, readonly: true

    belongs_to :project, repository: "Project::Repository", foreign_key: :project_id
    belongs_to :dataset, repository: "Dataset::Repository", foreign_key: :dataset_id
    belongs_to :entry, repository: "Entry::Repository", foreign_key: :entry_id
  end

  class Repository < Verse::Sequel::Repository
    self.table = "annotations"
    self.resource = Resource::Dataset::Annotations

    encoder :shape_args, Verse::Sequel::JsonEncoder
    encoder :properties, Verse::Sequel::JsonEncoder
    encoder :metadata, Verse::Sequel::JsonEncoder

    # Soft-delete visibility filter. Deleted annotations are returned by default
    # (matching how `disabled_at` works on project_members — no default exclusion).
    # Consumers opt into filtering via `deleted: "true"/"false"`.
    custom_filter :deleted do |collection, value|
      enabled = value.to_s.downcase == "true"
      if enabled
        collection.where(Sequel.~(deleted_at: nil))
      else
        collection.where(deleted_at: nil)
      end
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          project_ids = auth_context.custom_scopes[:project]
          if org_ids
            table.where(
              table.db[:projects]
                .where(organization_id: org_ids)
                .where(id: Sequel[:annotations][:project_id])
                .select(1).exists
            )
          elsif project_ids
            table.where(project_id: project_ids)
          else
            table.where(Sequel.lit("false"))
          end
        end

        scope.as_user? { user_project_scoped_query(action) }
      end
    end

    # New annotations always start at version 1, whatever `attributes` carries
    # (duplication in `Entry::Service#duplicate_entries` copies `annotation.fields`,
    # which includes the source's `version`).
    def create(attributes)
      with_db_mode(:rw) do
        transaction do
          super(attributes.merge(version: 1))
        end
      end
    end

    # Write (upsert) or delete a single annotation_shape row: a Hash value
    # upserts, nil deletes (idempotent — deleting a non-existent key succeeds
    # silently). Publishes no event.
    def write_shape(annotation_id, key, value)
      raise Verse::Error::ValidationFailed, "key is required" if key.nil? || key.empty?

      unless value.nil? || value.is_a?(Hash)
        raise Verse::Error::ValidationFailed,
              "value must be null (to delete) or a Hash (to upsert)"
      end

      write_shapes(annotation_id, [{ key:, value: }])
    end

    # Write (upsert) or delete several annotation_shape rows as one write:
    # entries is [{ key: String, value: Hash | nil }]. Upserts rows with a
    # Hash value, deletes rows with a nil value (idempotent for keys with no
    # row). Locks the annotation row, so a concurrent soft-delete cannot slip
    # between the service's guard and this write. Publishes no event.
    def write_shapes(annotation_id, entries)
      with_db_mode(:rw) do
        transaction do
          row = scoped(:update).where(id: annotation_id).for_update.first
          raise Verse::Error::RecordNotFound, annotation_id unless row

          if row[:deleted_at]
            raise Verse::Error::ValidationFailed,
                  "Cannot write shape to a deleted annotation"
          end

          keys = entries.map { |e| e[:key] }
          existing = client do |db|
            db[:annotation_shape].where(annotation_id:, key: keys).all
          end
          existing_by_key = existing.each_with_object({}) do |shape, out|
            out[shape[:key].to_s] = shape[:value]
          end

          old_shapes = {}
          new_shapes = {}

          entries.each do |entry|
            key = entry[:key].to_s
            value = entry[:value]

            old_shapes[key] = existing_by_key[key] if existing_by_key.key?(key)
            new_shapes[key] = value unless value.nil?
          end

          # Build the change list as if every key were part of shape_args, so
          # paths are shape_args.<key>... — history replay expects tiles under
          # shape_args. A new key gives +, a nil value on an existing key gives
          # -, a nil value on a key with no row gives nothing, and changed
          # values recurse.
          changes = AnnotationDiff.call(
            { shape_args: old_shapes },
            { shape_args: new_shapes }
          )

          return true if changes.empty?

          now = Time.now.utc

          client do |db|
            entries.each do |entry|
              key = entry[:key]
              value = entry[:value]

              if value.nil?
                db[:annotation_shape].where(annotation_id:, key:).delete
              else
                db[:annotation_shape]
                  .insert_conflict(
                    target: %i[annotation_id key],
                    update: { value: ::Sequel.lit("EXCLUDED.value") }
                  )
                  .insert(annotation_id:, key:, value: ::Sequel.pg_jsonb(value))
              end
            end
          end

          # Touch the parent annotation's updated_at so the IDB sync mechanism
          # (which uses updated_at__gt) picks up shape changes on reconnect.
          update_impl(
            annotation_id,
            { updated_at: now },
            scope: scoped(:update)
          )

          true
        end
      end
    end

    # Actions                       | Roles
    # read, create, update, delete  | project_owner, annotator, reviewer
    #
    # Info:
    # 1. project_owner can create, update and delete annotations
    # 2. annotator and reviewer project members can create, update, delete and read
    # annotations only for entries assigned to them
    query
    def user_project_scoped_query(action)
      # Ignore create action as it will be handled in service layer
      return table if action == :create

      account_id = auth_context.metadata[:id]

      scoped_fragment = <<-SQL
        EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.account_id = :account_id
            AND pm.project_id = annotations.project_id
            AND pm.disabled_at IS NULL
            AND (
              -- All with roles
              pm.role IN :with_roles OR
              (
                -- From assigned entries with roles
                pm.role IN :assigned_to_roles AND
                EXISTS (
                  SELECT 1
                  FROM entries e
                  WHERE e.id = annotations.entry_id
                    AND e.assigned_to_id = :account_id
                )
              )
            )
        )
      SQL

      case action
      when :read, :update, :delete
        table.where(
          Sequel.lit(
            scoped_fragment,
            account_id:,
            with_roles: %w[project_owner],
            assigned_to_roles: %w[annotator reviewer]
          )
        )
      else
        raise Verse::Error::Unauthorized,
              "Permission denied for \"#{action}\" action on #{self.class.resource}"
      end
    end
  end
end
