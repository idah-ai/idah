# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:project_members) do
      # # Remove the composite index on project_id and role
      # drop_index [:project_id, :role]

      # Rename role column to permission_set
      rename_column :role, :permission_set

      # Make invited_by_id nullable with default null
      set_column_allow_null :invited_by_id
      set_column_default :invited_by_id, nil
    end

    alter_table(:datasets) do
      add_column :created_by_id, :bigint, null: true, index: true
    end
  end
end
