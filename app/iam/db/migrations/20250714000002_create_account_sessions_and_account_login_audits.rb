# frozen_string_literal: true

Sequel.migration do
  change do
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

    create_table(:account_login_audits) do
      primary_key :id

      foreign_key :account_id,
                  :accounts,
                  type: :bigint,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade,
                  index: true

      column :role, String, null: true
      column :logged_in_at, DateTime, default: Sequel.lit("NOW()"), null: false

      column :ip, String, null: true
      column :user_agent, String, text: true

      index [:account_id, :logged_in_at]
      index :logged_in_at, type: :brin # Useful because table is read-only append-only.
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_login_audits)
  end
end
