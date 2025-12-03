# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

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

    # Create initial admin account
    now = Time.now
    from(:accounts).insert(
      name: "admin",
      email: "admin@idah.ai",
      role_name: "admin",
      role_scope: "{}",
      hashed_password: BCrypt::Password.create("password"),
      enabled: true,
      joined_at: now,
      created_at: now,
      updated_at: now,
    )
  end
end
