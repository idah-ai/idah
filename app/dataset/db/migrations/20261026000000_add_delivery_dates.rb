# frozen_string_literal: true

Sequel.migration do
  up do
    alter_table(:datasets) { add_column :delivery_date, Date, null: true }
    alter_table(:entries) { add_column :delivery_date, Date, null: true }
  end

  down do
    alter_table(:entries) { drop_column :delivery_date }
    alter_table(:datasets) { drop_column :delivery_date }
  end
end
