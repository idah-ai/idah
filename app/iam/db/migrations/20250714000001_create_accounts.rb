# frozen_string_literal: true

# Accounts and their sessions.
Sequel.migration do
  change do
    create_table(:accounts) do
      primary_key :id, :bigserial

      column :name, String
      column :email, String, unique: true, null: false, index: true

      column :role_name, String, null: false, default: "user"
      column :role_scope, :jsonb, null: false, default: "{}"

      column :picture_url, String, null: true

      column :hashed_password, String, null: true
      column :password_reset_token, String, null: true
      column :password_reset_token_expires_at, DateTime, null: true
      column :sso_channel, String, null: true

      column :enabled, TrueClass, index: true

      column :joined_at, Time, null: true
      column :invitation_expired_at, Time, null: true

      Migration::Timestamps.timestamps(self)

      # Added after the timestamps so the column order matches databases that
      # migrated through 20260114000000_add_invitation_token_to_accounts.
      column :invitation_token, String, null: true, index: true
    end
    Migration::Timestamps.trg_updated_at(self, :accounts)

    create_table(:account_sessions) do
      primary_key :id

      foreign_key :account_id,
                  :accounts,
                  type: :bigint,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade,
                  index: true

      column :ip, String
      column :user_agent, String

      column :refresh_seq, :bigint, null: false, default: 0
      column :nonce, :bigint, null: false, default: 0

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_sessions)
  end
end
