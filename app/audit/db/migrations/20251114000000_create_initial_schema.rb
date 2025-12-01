# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:logs) do
      column :id, :bigserial, primary_key: true

      # Who performed the action
      column :actor_account_id, :bigint, null: false, index: true
      # column :actor_name, String, null: true
      # column :actor_email, String, null: false, index: true

      # What action was performed
      column :action, String, null: false, index: true

      column :resource_service, String, null: false, index: true
      column :resource_type, String, null: false, index: true
      column :resource_id, String, null: false, index: true

      # Full event details (Verse event message object)
      # column :event_data, :jsonb, null: false

      # Organization context (for multi-tenant filtering)
      column :organization_id, :bigint, null: true, index: true

      # Timestamp of the action/event itself
      column :event_timestamp, DateTime, null: false, index: true

      # Log's created_at timestamp (when this log entry was created)
      Migration::Timestamps.timestamps(self)
    end

    # Composite indexes for common query patterns
    add_index :logs, [:actor_account_id, :event_timestamp]
    add_index :logs, [:action, :event_timestamp]
    add_index :logs, [:resource_type, :event_timestamp]
    add_index :logs, [:organization_id, :event_timestamp]

    # # Trigram index for text search on actor_email
    # execute "CREATE INDEX idx_logs_actor_email_trgm ON logs USING gin (actor_email gin_trgm_ops)"
  end
end
