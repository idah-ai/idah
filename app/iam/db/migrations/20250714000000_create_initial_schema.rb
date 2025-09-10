# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:users) do
      column :id, :bigint, primary_key: true

      column :name, String
      column :email, String, index: true

      column :hashed_password, String, null: true
      column :sso_channel, String, null: true

      column :enabled, TrueClass, index: true

      column :roles, "text[]"
      index [:roles], type: :gin

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :users)

    create_table(:teams) do
      column :id, :bigint, primary_key: true
      column :name, String
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :teams)

    create_table(:user_teams) do
      column :id, :bigint, primary_key: true
      foreign_key :user_id, :users,
        type: :bigint,
        null: false,
        on_delete: :cascade,
        on_update: :cascade

      foreign_key :team_id, :teams,
        type: :bigint,
        null: false,
        on_delete: :cascade,
        on_update: :cascade

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :user_teams)
  end
end
