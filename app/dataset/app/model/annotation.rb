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
    # which includes the source's `version`). Records a `created` history row
    # with one `+` entry per tracked field that is not nil, inside the same
    # transaction as the insert.
    def create(attributes)
      with_db_mode(:rw) do
        transaction do
          attributes = attributes.dup.merge(version: 1)
          id = super(attributes)
          record_create_change!(id, attributes)
          id
        end
      end
    end

    # Read-only fields an op may still write. Only soft_delete and restore pass
    # these ops.
    OP_WRITABLE_FIELDS = {
      deleted: %i[deleted_at deleted_by_email],
      restored: %i[deleted_at deleted_by_email],
    }.freeze

    # Update an annotation. Enforces the fields this op may write, rejects a
    # blank category, and keeps `annotation_shape` keys out of the `shape_args`
    # column — the rules JSON:API update and RPC update now share, because they
    # live below both entry points.
    #
    # Records one `updated` history row with the exact diff at `version + 1`.
    # A write that changes nothing (after the field filter, blank-category
    # check and tile stripping) writes nothing, does not bump the version and
    # records nothing.
    #
    # `op` selects which read-only fields the write may still touch (the
    # soft_delete / restore ops) and names the history row; it is not passed
    # to `super`. `scope` keeps its base-method default (`scoped(:update)`) so
    # callers such as `update!` pass one.
    def update(id, attributes, scope: scoped(:update), op: :updated) # rubocop:disable Naming/MethodParameterName
      with_db_mode(:rw) do
        transaction do
          allowed = OP_WRITABLE_FIELDS.fetch(op, [])
          attributes = attributes.reject do |key, _|
            field = Annotation::Record.fields[key.to_sym]
            key.to_sym == :id || field.nil? || (field[:readonly] && !allowed.include?(key.to_sym))
          end

          if attributes.key?(:category) &&
             (attributes[:category].nil? || attributes[:category].to_s.strip.empty?)
            raise Verse::Error::ValidationFailed,
                  "category is required to update an annotation"
          end

          row = scope.where(id:).for_update.first
          return false unless row

          strip_shape_store_keys(id, attributes)

          changes = diff_for_update(row, attributes)
          return true if changes.empty?

          version = row[:version] + 1
          success = super(id, attributes.merge(version:), scope:)
          return false unless success

          record_change!(id, op:, changes:, version:, entry_id: row[:entry_id], project_id: row[:project_id])
          true
        end
      end
    end

    # Soft-delete an annotation: set `deleted_at` / `deleted_by_email`, bump the
    # version and record a `deleted` history row. A second delete is a no-op —
    # it keeps the original `deleted_at` and `deleted_by_email`, writes nothing
    # and publishes no `deleted` event.
    event(name: "deleted")
    def soft_delete(id, deleted_by_email:)
      no_event do
        row = scoped(:delete).where(id:).for_update.first or raise Verse::Error::RecordNotFound, id
        next false if row[:deleted_at] # already deleted: no write, no history row, no event

        update(id, { deleted_at: Time.now.utc, deleted_by_email: }, scope: scoped(:delete), op: :deleted) or
          raise Verse::Error::RecordNotFound, id
      end
    end

    # Restore a soft-deleted annotation: clear the tombstone, bump the version
    # and record a `restored` history row. A restore on a live annotation is a
    # no-op.
    event(name: "restored")
    def restore(id)
      no_event do
        row = scoped(:update).where(id:).for_update.first or raise Verse::Error::RecordNotFound, id
        next false if row[:deleted_at].nil? # live annotation: no write, no history row, no event

        update(id, { deleted_at: nil, deleted_by_email: nil }, scope: scoped(:update), op: :restored) or
          raise Verse::Error::RecordNotFound, id
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

          # Touch the parent annotation's updated_at (the IDB sync mechanism
          # uses updated_at__gt) and bump version once for the whole call.
          # update_impl writes the two columns directly, skipping the `update`
          # override, and publishes nothing.
          version = row[:version] + 1
          update_impl(
            annotation_id,
            { updated_at: now, version: },
            scope: scoped(:update)
          ) or raise Verse::Error::RecordNotFound, annotation_id

          record_change!(
            annotation_id,
            op: "updated",
            changes:,
            version:,
            entry_id: row[:entry_id],
            project_id: row[:project_id]
          )

          true
        end
      end
    end

    private

    # Remove keys from `attributes[:shape_args]` that exist in annotation_shape
    # for this annotation — tile keys must live only in the child table, never
    # in the parent's jsonb column. Keys that already sit in the column (sent
    # by the editor through RPC update before this change) are dropped on the
    # next write, with no history entry, since reads already show the
    # annotation_shape values; the live tile values are unaffected.
    def strip_shape_store_keys(id, attributes)
      return unless attributes[:shape_args].is_a?(Hash)

      shape_keys = client do |db|
        db[:annotation_shape]
          .where(annotation_id: id)
          .select_map(:key)
          .map(&:to_s)
      end
      return if shape_keys.empty?

      attributes[:shape_args] = attributes[:shape_args].reject { |k, _| shape_keys.include?(k.to_s) }
    end

    # The diff of the tracked fields that were written. The old side is the
    # locked row, sliced to the written keys, with the `annotation_shape` keys
    # dropped from its `shape_args` column (reads replace those keys with the
    # child-table values, so removing the leak is not a visible change and
    # records no entry). Identity keys come from the plugin manifests, keyed by
    # the row's shape_type — or the new one when the same write changes it.
    def diff_for_update(row, attributes)
      old_for_diff = row.slice(*attributes.keys.map(&:to_sym))

      if attributes.key?(:shape_args) && old_for_diff[:shape_args].is_a?(Hash)
        old_for_diff[:shape_args] = old_for_diff[:shape_args].reject do |k, _|
          shape_keys_include?(row[:id], k.to_s)
        end
      end

      identity_keys = AnnotationDiff::IdentityKeys.for(attributes.fetch(:shape_type, row[:shape_type]))
      AnnotationDiff.call(old_for_diff, attributes, identity_keys: identity_keys)
    end

    def shape_keys_include?(annotation_id, key)
      @shape_keys_include ||= {}
      @shape_keys_include[annotation_id] ||= client do |db|
        db[:annotation_shape].where(annotation_id:).select_map(:key).map(&:to_s)
      end
      @shape_keys_include[annotation_id].include?(key)
    end

    # Insert one history row, inside the write's transaction. `version` is the
    # integer the write just stored (1 for create, row[:version] + 1 otherwise).
    # Any failure here raises and rolls back the annotation write.
    def record_change!(annotation_id, op:, changes:, version:, entry_id:, project_id:) # rubocop:disable Naming/MethodParameterName
      client do |db|
        db[:annotation_changes].insert(
          id: UUIDv7.generate,
          annotation_id:,
          entry_id:,
          project_id:,
          account_id: change_actor_id,
          op: op.to_s,
          version:,
          changes: Verse::Sequel::JsonEncoder.encode(changes),
          changed_at: Time.now.utc
        )
      end
    end

    # One `+` entry per tracked field that is not nil: shape_type, shape_args,
    # category, properties, metadata, and deleted_at / deleted_by_email when a
    # soft-deleted annotation is copied (Entry::Service#duplicate_entries).
    TRACKED_CREATE_FIELDS = %i[shape_type shape_args category properties metadata deleted_at deleted_by_email].freeze

    def record_create_change!(annotation_id, attributes)
      changes = TRACKED_CREATE_FIELDS.filter_map do |field|
        value = attributes[field]
        next if value.nil?

        ["+", field.to_s, nil, value]
      end

      return if changes.empty?

      record_change!(
        annotation_id,
        op: "created",
        changes:,
        version: 1,
        entry_id: attributes[:entry_id],
        project_id: attributes[:project_id]
      )
    end

    # The only place that decides the actor of a history row: the repository
    # metadata's actor (when the record is created inside `with_actor`) or the
    # auth context's account id; nil on a system context.
    def change_actor_id
      @metadata[:actor_account_id] || auth_context.metadata[:id]
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
