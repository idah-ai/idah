# frozen_string_literal: true

# Generated exports.
Sequel.migration do
  change do
    create_table(:exports) do
      primary_key :id, :bigserial

      column :job_id, :uuid, null: false, index: true
      column :project_id, String, null: false, index: true
      column :created_by_id, Integer, null: false, index: true

      # These fields are populated when the export is ready,
      # and used to store the exported file information.
      column :file_id, String, null: true, index: true
      column :filename, String, null: true, index: true
      column :mime_type, String, null: true, index: true
      column :size, Integer, default: 0, null: false

      Migration::Timestamps.timestamps(self, updated_at: false)
    end
  end
end
