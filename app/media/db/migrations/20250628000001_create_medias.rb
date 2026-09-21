# frozen_string_literal: true

# Stored media files.
Sequel.migration do
  change do
    create_table(:medias) do
      column :id, String, primary_key: true

      column :resource, String, null: false, index: true
      column :key, String, null: false, default: ""

      column :filename, String, null: false

      # unique index on key and id:
      index [:resource, :key], unique: true

      column :size, Integer, null: false
      column :mime_type, String, null: false

      column :created_by, Integer, index: true
      column :created_role, String

      column :public, TrueClass, null: false, default: false, index: true
      column :meta, :jsonb, null: false, default: "{}"

      column :project_id, String, index: true

      # Able to use LIKE on media key.
      index :key, opclass: :gin_trgm_ops, type: :gin

      Migration::Timestamps.timestamps(self, updated_at: false)
    end
  end
end
