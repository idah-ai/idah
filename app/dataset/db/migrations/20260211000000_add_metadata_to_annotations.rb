# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:annotations) do
      add_column :metadata, :jsonb
    end
  end
end
