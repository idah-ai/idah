# frozen_string_literal: true

# Reusable feedback configuration templates, scoped to an organization.
Sequel.migration do
  change do
    create_table(:feedback_config_templates) do
      primary_key :id, :bigserial

      column :organization_id, :bigint, null: false, index: true

      column :name, String, null: false, index: true
      column :feedback_configuration, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
      column :modality, String, null: false

      column :created_by_id, :bigint, null: false
      column :updated_by_id, :bigint, null: false

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :feedback_config_templates)
  end
end