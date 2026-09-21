# frozen_string_literal: true

# Global settings and their per-account overrides.
Sequel.migration do
  change do
    create_table(:settings) do
      column :id, :bigserial, primary_key: true

      column :key, String, unique: true, null: false
      column :value, :jsonb, null: false

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :settings)

    create_table(:account_settings) do
      column :id, :bigserial, primary_key: true

      column :account_id, :bigint, null: true, index: true

      column :key, String, null: false
      column :plugin, String, null: false, index: true, default: ""
      column :value, :jsonb, null: false

      index %i[account_id key plugin], unique: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :account_settings)
  end
end
