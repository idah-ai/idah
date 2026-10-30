# frozen_string_literal: true

# Adds syncing_stats boolean to datasets for signaling FE that
# entry-stats recomputation is in progress after labeling_config changes.
Sequel.migration do
  change do
    alter_table(:datasets) do
      add_column :syncing_stats, TrueClass, default: false, null: false
    end
  end
end
