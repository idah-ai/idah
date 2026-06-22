# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:entries) do
      add_column :assigned_to_email, String, null: true
      add_column :submitted_by_email, String, null: true
      add_column :reviewed_by_email, String, null: true
    end
  end
end
