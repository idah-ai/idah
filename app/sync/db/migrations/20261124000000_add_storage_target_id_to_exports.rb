# frozen_string_literal: true

# The storage target an export file is written to. NULL is the default storage,
# which every existing export is in.
Sequel.migration do
  change do
    alter_table(:exports) do
      add_column :storage_target_id, :uuid, null: true, index: true
    end
  end
end
