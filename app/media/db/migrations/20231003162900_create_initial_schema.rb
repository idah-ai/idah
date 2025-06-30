# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:medias) do
      column :id, String, primary_key: true
      column :key, String, null: false, default: "", index: true

      # unique index on key and id:
      index [:key, :id], unique: true

      column :size, Integer, null: false
      column :mime_type, String, null: false

      column :created_by, Integer, index: true
      column :created_role, String

      column :public, TrueClass, null: false, default: false, index: true

      Migration::Timestamps.timestamps(self, updated_at: false)
    end

    create_table(:jobs) do
      column :id, :bigserial, primary_key: true

      column :job_class, String, null: false, index: true
      column :arguments, :jsonb, text: true, null: false

      column :priority, Integer, null: false, default: 0, index: true

      column :status, String, null: false, index: true, default: 'pending'
      column :progress, Float, null: false, default: 0.0 # from 0.0 to 1.0
      column :retry_count, Integer, null: false, default: 0

      column :error, String

      column :scheduled_at, DateTime, null: false, index: true

      Migration::Timestamps.timestamps(self)
    end

  end
end
