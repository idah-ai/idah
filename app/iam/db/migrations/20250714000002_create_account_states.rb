# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:account_states) do
      primary_key :id

      foreign_key :account_id,
                  :accounts,
                  type: :bigint,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade,
                  index: true

      column :refresh_seq, :bigint, null: false, default: 0
      column :nonce, :bigint, null: false, default: 0

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_states)
  end
end
