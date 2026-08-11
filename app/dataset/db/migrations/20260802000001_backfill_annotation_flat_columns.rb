# frozen_string_literal: true

# Migration B — backfill (idempotent, batched).
#
# Populates the new flattened columns from the legacy `dimensions` and
# `annotation` JSONB columns. Runs in batches to avoid locking the whole
# table at once. Idempotent: only rows where `shape_type` is still NULL
# are processed, so re-running is safe.
#
# NOTE: `category` is going to be NOT NULL (Migration C). This migration
# does NOT invent a value for rows that have no category set — the audit
# query from Part 0.3 must be run first and any null-category rows resolved
# deliberately before Migration C ships.
Sequel.migration do
  Sequel.extension :pg_json
  BATCH_SIZE = 1000

  up do
    extension :pg_json

    loop do
      # Select a batch of ids that still need backfilling.
      ids = from(:annotations)
            .where(shape_type: nil)
            .order(:id)
            .limit(BATCH_SIZE)
            .select_map(:id)

      break if ids.empty?

      from(:annotations).where(id: ids).each do |row|
        dims = row[:dimensions] || {}
        anno = row[:annotation] || {}
        category = anno["category"]
        shape_type = dims["type"]
        properties = anno["attributes"] || {}
        shape_args = dims.reject { |k, _| k == "type" }

        from(:annotations).where(id: row[:id]).update(
          shape_type:,
          shape_args: Sequel.pg_jsonb(shape_args),
          category:,
          properties: Sequel.pg_jsonb(properties),
        )
      end
    end
  end

  down do
    extension :pg_json

    # Reverse the backfill: reconstruct the legacy `dimensions`/`annotation`
    # JSON columns from the new columns, then NULL the new columns out so the
    # pre-backfill state is fully restored.
    #
    #   dimensions = shape_args + { type: shape_type }
    #   annotation = { category: category, attributes: properties }
    from(:annotations).where(Sequel.~(shape_type: nil)).each do |row|
      dims = (row[:shape_args] || {}).dup
      dims["type"] = row[:shape_type] if row[:shape_type]

      anno = {}
      anno["category"] = row[:category] if row[:category]
      anno["attributes"] = row[:properties] || {} if row[:properties]

      from(:annotations).where(id: row[:id]).update(
        dimensions: Sequel.pg_jsonb(dims),
        annotation: Sequel.pg_jsonb(anno),
        shape_type: nil,
        shape_args: nil,
        category: nil,
        properties: nil,
      )
    end
    alter_table(:annotations) do
      set_column_not_null :dimensions
      set_column_not_null :annotation
    end
  end
end
