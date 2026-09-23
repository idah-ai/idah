# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:datasets) do
      add_column :workflow_name, String, null: true
    end
  end
end
