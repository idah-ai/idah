# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:accounts) do
      add_column :role_scope, :jsonb, null: false, default: "{}"
    end
  end
end
