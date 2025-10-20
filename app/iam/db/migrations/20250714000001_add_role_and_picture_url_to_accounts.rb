# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:accounts) do
      add_column :role, String, null: true
      add_column :picture_url, String, null: true
    end
  end
end
