# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:datasets) do
      add_column :name, String, null: false, default: ""
      add_index :name, opclass: :gin_trgm_ops, type: :gin
    end
  end
end
