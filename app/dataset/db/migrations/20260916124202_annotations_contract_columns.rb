# frozen_string_literal: true

# Migration C — contract (ships in a later release, after a bake period).
#
# Do NOT ship this migration in the same release as Migration A/B, or in the
# same release as the application-code cutover. Ship it at least 14 days after
# those land in production — this matches EXPIRATION_PERIOD_MS, the client-side
# IDB cache's own expiration window, so no browser session running old-shaped
# cached data can still be active by the time this runs.
#
# Before running, verify:
#   select count(*) from annotations where shape_type is null or shape_args is null or category is null;
# must return 0. If the `category` count specifically is non-zero, do not add
# `set_column_not_null :category` until those rows are resolved — split this
# migration so `shape_type`/`shape_args` go NOT NULL on schedule while
# `category`'s constraint waits on data cleanup.
Sequel.migration do
  up do
    alter_table(:annotations) do
      set_column_not_null :shape_type
      set_column_not_null :shape_args
      set_column_not_null :category
      drop_column :dimensions
      drop_column :annotation
    end
  end

  down do
    # Restore the legacy columns (matching the original schema: jsonb, not null)
    # and relax the new columns back to nullable so the pre-contract state is
    # fully restored for testers switching branches.
    alter_table(:annotations) do
      add_column :dimensions, :jsonb
      add_column :annotation, :jsonb
      set_column_allow_null :shape_type
      set_column_allow_null :shape_args
      set_column_allow_null :category
    end
  end
end
