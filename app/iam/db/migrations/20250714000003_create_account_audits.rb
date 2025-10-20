# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:account_audits) do
      primary_key :id, :bigserial

      foreign_key :account_id,
                  :accounts,
                  type: :bigint,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade,
                  index: true

      column :role, String, null: true
      column :date, Time, null: false
      column :ip, :jsonb, null: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_audits)
  end
end
