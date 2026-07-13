# frozen_string_literal: true

Sequel.migration do
  change do
    add_index :annotations, :updated_at
    add_index :note_feeds, [:project_id, :status]
    add_index :entries, :resource
  end
end
