# frozen_string_literal: true

# The storage target the project's files and exports go to, chosen when the
# project is created and never changed. NULL is the default storage.
Sequel.migration do
  change do
    alter_table(:projects) do
      add_column :storage_target_id, :uuid, null: true, index: true
    end
  end
end
