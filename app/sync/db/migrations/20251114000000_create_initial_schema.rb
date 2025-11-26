# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:jobs) do
      column :id, :bigserial, primary_key: true

      column :job_class, String, null: false, index: true
      column :arguments, :jsonb, text: true, null: false

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
    Migration::Timestamps.trg_updated_at(self, :jobs)
  end
end
