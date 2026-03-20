# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:api_keys) do
      primary_key :id

      foreign_key :account_id,
                  :accounts,
                  type: :bigint,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade,
                  index: true

      column :name, String, null: true

      column :key_label, String, null: false
      column :key_sha, String, null: false, unique: true, index: true

      column :permissions, "text[]", null: false

      column :scope_type, String, null: false # all | org | project
      column :scope_value, "text[]", null: false # List of org_ids or project_ids based on scope_type

      column :status, String, null: false, default: "active", index: true # active | revoked | expired
      column :expires_at, Time, null: true
      column :revoked_at, Time, null: true

      column :last_used_at, Time, null: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :api_keys)
  end
end
