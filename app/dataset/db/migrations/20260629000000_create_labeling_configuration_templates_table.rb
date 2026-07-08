# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:labeling_configuration_templates) do
      primary_key :id, :bigserial

      column :organization_id, :bigint, null: false, index: true

      column :name, String, null: false, index: true
      column :labeling_configuration, :jsonb, null: false, default: "{}"
      column :modality, String, null: false

      column :created_by_id, :bigint, null: false
      column :updated_by_id, :bigint, null: false

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :labeling_configuration_templates)
  end
end
