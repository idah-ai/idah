# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:entries) do
      add_column :filename, String, null: false, default: ""
    end
  end
end
