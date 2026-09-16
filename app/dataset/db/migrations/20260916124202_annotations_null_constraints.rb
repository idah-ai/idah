# frozen_string_literal: true
Sequel.migration do
  up do
    alter_table(:annotations) do
      set_column_not_null :shape_type
      set_column_not_null :shape_args
      set_column_not_null :category
    end
  end

  down do
    alter_table(:annotations) do
      set_column_allow_null :shape_type
      set_column_allow_null :shape_args
      set_column_allow_null :category
    end
  end
end
