# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:project_members) do
      add_column :disabled_at, DateTime, null: true, index: true
    end
  end
end
