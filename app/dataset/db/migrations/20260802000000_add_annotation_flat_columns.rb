# frozen_string_literal: true

# Migration A — expand (additive, safe to deploy alone).
#
# Adds the flattened annotation columns alongside the legacy `dimensions`
# and `annotation` columns. All new columns start nullable; the NOT NULL
# constraints are added in Migration C (contract) after a bake period.
Sequel.migration do
  up do
    alter_table(:annotations) do
      add_column :shape_type, :text
      add_column :shape_args, :jsonb
      add_column :category, :text # NOT NULL added in Migration C — do not add it here, the column
                                  # starts empty for every existing row.
      add_column :properties, :jsonb
      add_column :deleted_at, :timestamp
      add_column :deleted_by_email, :text
      add_index :deleted_at
      add_index :category
    end
  end

  down do
    alter_table(:annotations) do
      drop_index :deleted_at
      drop_index :category
      drop_column :shape_type
      drop_column :shape_args
      drop_column :category
      drop_column :properties
      drop_column :deleted_at
      drop_column :deleted_by_email
    end
  end
end
