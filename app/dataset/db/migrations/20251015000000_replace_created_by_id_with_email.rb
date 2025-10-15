# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:note_feeds) do
      add_column :created_by_email, String, null: true, index: true
      drop_column :created_by_id
    end

    alter_table(:note_comments) do
      add_column :created_by_email, String, null: true, index: true
      drop_column :created_by_id
    end
  end
end
