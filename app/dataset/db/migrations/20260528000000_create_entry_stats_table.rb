# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:entry_stats) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")

      foreign_key :entry_id,
                  :entries,
                  type: :uuid,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade

      column :key,   String, null: false
      column :value, String, null: false

      Migration::Timestamps.timestamps(self)

      index [:entry_id, :key], unique: true, name: :idx_entry_stats_entry_key
      index :key, name: :idx_entry_stats_key
    end

    Migration::Timestamps.trg_updated_at(self, :entry_stats)
  end
end
