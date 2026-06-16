# frozen_string_literal: true

Sequel.migration do
  up do
    add_column :api_keys, :created_by_id, :bigint, null: true
  end

  down do
    drop_column :api_keys, :created_by_id
  end
end
