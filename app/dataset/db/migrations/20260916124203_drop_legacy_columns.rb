# frozen_string_literal: true
Sequel.migration do
  up do
    alter_table(:annotations) do
      drop_column :dimensions
      drop_column :annotation
    end
  end

  down do
    alter_table(:annotations) do
      add_column :dimensions, :jsonb
      add_column :annotation, :jsonb
    end
  end
end
