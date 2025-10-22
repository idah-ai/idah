# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:account_audits) do
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

      column :platform, String, null: true
      column :user_agent, String, text: true

      index [:account_id, :logged_in_at]
      index :logged_in_at, type: :brin # Useful because table is read-only append-only.
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_audits)
  end
end
