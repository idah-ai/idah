# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:project_members) do
      # Remove the composite index on project_id and role
      drop_index [:project_id, :role]

      # Remove the role column
      drop_column :role

      # Make invited_by_id nullable with default null
      set_column_allow_null :invited_by_id
      set_column_default :invited_by_id, nil
    end
  end
end
