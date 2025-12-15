# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:logs) do
      column :id, :bigserial, primary_key: true

      # who performed the action
      column :actor_account_id, :bigint, null: false, index: true
      column :actor_account_email, String, null: true, index: true

      # action performed
      column :action, String, null: false, index: true

      # resource info
      column :resource_service, String, null: false, index: true
      column :resource_type, String, null: false, index: true
      column :resource_id, String, null: false, index: true

      # most relevant ids, denormalized
      column :organization_id, :bigint, null: true, index: true
      column :project_id, String, null: true, index: true
      column :dataset_id, String, null: true, index: true
      column :entry_id, String, null: true, index: true

      # timestamp of the action/event itself
      column :event_timestamp, DateTime, null: false, index: true

      # log's created_at timestamp (when this log entry was created)
      Migration::Timestamps.timestamps(self)
    end

    # composite indexes for common query patterns
    add_index :logs, [:actor_account_id, :event_timestamp]
    add_index :logs, [:actor_account_email, :event_timestamp]
    add_index :logs, [:action, :event_timestamp]
    add_index :logs, [:resource_type, :event_timestamp]
    add_index :logs, [:organization_id, :event_timestamp]
    add_index :logs, [:project_id, :event_timestamp]
    add_index :logs, [:dataset_id, :event_timestamp]
    add_index :logs, [:entry_id, :event_timestamp]
  end
end
