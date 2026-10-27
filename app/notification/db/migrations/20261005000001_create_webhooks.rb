# frozen_string_literal: true

# Webhooks, owned by an (account, role) pair. The role is the one the account
# had when creating the webhook.
Sequel.migration do
  change do
    create_table(:webhooks) do
      primary_key :id, type: :bigint

      column :account_id, :bigint, null: false, index: true
      column :role_name, String, null: false

      column :name, String, null: false
      column :url, String, null: false
      column :secret, String, null: false

      column :events, "text[]", null: false
      column :enabled, TrueClass, null: false, default: false

      Migration::Timestamps.timestamps(self)

      index :events, type: :gin
    end
    Migration::Timestamps.trg_updated_at(self, :webhooks)
  end
end
