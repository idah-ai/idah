# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:jobs) do
      column :id, :bigserial, primary_key: true

      column :job_class, String, null: false, index: true
      column :arguments, :jsonb, text: true, null: false

      column :created_by, Integer, null: false, index: true
      column :created_by_role, String, null: false, index: true
      column :created_by_organization, Integer, null: true, index: true
      column :created_by_custom_scopes, :jsonb, text: true, null: false
      column :created_by_metadata, :jsonb, text: true, null: false

      column :priority, Integer, null: false, default: 0, index: true

      column :status, String, null: false, index: true, default: "pending"
      column :progress, Float, null: false, default: 0.0 # from 0.0 to 1.0
      column :retry_count, Integer, null: false, default: 0

      column :unicity,
             String,
             null: true,
             unique: true,
             comment: "Unique identifier for the job, used to prevent duplicate jobs."

      column :error, String

      column :scheduled_at, DateTime, null: false, index: true

      Migration::Timestamps.timestamps(self)
    end

    create_table(:exports) do
      column :id, String, primary_key: true
      column :job_id, String, null: false, index: true

      column :filename, String, null: false

      column :size, Integer, null: false
      column :mime_type, String, null: false

      column :created_by, Integer, null: false, index: true
      column :created_by_role, String, null: false, index: true
      column :created_by_organization, Integer, null: true, index: true
      column :created_by_custom_scopes, :jsonb, text: true, null: false
      column :created_by_metadata, :jsonb, text: true, null: false

      column :meta, :jsonb, null: false, default: "{}"

      Migration::Timestamps.timestamps(self, updated_at: false)
    end

    Migration::Timestamps.trg_updated_at(self, :jobs)
  end
end
