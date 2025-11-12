# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:accounts) do
      primary_key :id, :bigserial

      column :name, String
      column :email, String, unique: true, null: false, index: true

      column :role, String, null: false, default: "user"

      column :picture_url, String, null: true

      column :hashed_password, String, null: true
      column :sso_channel, String, null: true

      column :enabled, TrueClass, index: true

      column :joined_at, Time, null: true

      column :scopes, :jsonb, null: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :accounts)

    create_table(:organizations) do
      primary_key :id, :bigserial
      column :name, String

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :organizations)

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
