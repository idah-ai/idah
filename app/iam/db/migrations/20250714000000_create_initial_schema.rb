# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:accounts) do
      primary_key :id, :bigserial

      column :name, String
      column :email, String, unique: true, null: false, index: true

      column :hashed_password, String, null: true
      column :sso_channel, String, null: true

      column :enabled, TrueClass, index: true

      column :joined_at, Time, null: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :accounts)

    create_table(:account_teams) do
      primary_key :id, :bigserial

      foreign_key :account_id, :accounts,
        type: :bigint,
        null: false,
        on_delete: :cascade,
        on_update: :cascade

      foreign_key :team_id, :account_teams,
        type: :bigint,
        null: false,
        on_delete: :cascade,
        on_update: :cascade

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_teams)
  end
end
