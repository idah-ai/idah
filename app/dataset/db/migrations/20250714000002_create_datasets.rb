# frozen_string_literal: true

# Datasets, which belong to a project.
Sequel.migration do
  change do
    create_table(:datasets) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")

      foreign_key :project_id,
                  :projects,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :name, String, null: false, default: ""

      # Type of dataset
      column :modality, String, null: false

      column :labels, "text[]", null: false, default: "{}"

      # Workflow configuration
      column :workflow_configuration, :jsonb, null: false

      # Domain specific data, related to the modality
      column :labeling_configuration, :jsonb, null: false

      # Enable or disable the dataset
      column :enabled, TrueClass, null: false, default: true

      column :status, String, null: false, index: true, default: "pending"

      column :progress, Float, null: false, default: 0.0 # from 0.0 to 1.0

      column :entries_total_count, Integer, null: false, default: 0
      column :entries_completed_count, Integer, null: false, default: 0
      column :entries_in_progress_count, Integer, null: false, default: 0

      Migration::Timestamps.timestamps(self)

      # Added after the initial release. Column order matches a database that
      # migrated through the old chain.
      column :entries_submitted_count, Integer, null: false, default: 0
    end
    Migration::Timestamps.trg_updated_at(self, :datasets)
  end
end
